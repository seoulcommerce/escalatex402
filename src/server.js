import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { z } from 'zod';

import { initDb, run, get, all } from './db.js';
import { getProvider, evaluateRequest } from './providers.js';
import { build402Payload } from './x402.js';
import { verifyUsdcPayment } from './solanaVerify.js';
import { buildSolanaPayUrl, makePaymentMemo, makeReferencePubkey, USDC_MINT } from './solanaPay.js';
import { loadConfig } from './config.js';
import { isWithinWorkingHours } from './availability.js';

initDb();
const CFG = loadConfig();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(new URL('./ui.html', import.meta.url).pathname);
});

app.get('/r/:id', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(new URL('./receipt.html', import.meta.url).pathname);
});

app.get('/health', async (_req, res) => {
  const count = await get('SELECT COUNT(*) as c FROM requests');
  res.json({ ok: true, requests: count?.c || 0 });
});

const CreateRequestSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(32)).max(10).default([]),
  budgetUsd: z.string().optional(),
  providerId: z.string().optional(),
});

/**
 * Create a new support request.
 */
async function createRequestInternal({ title, body, tags, budgetUsd, providerId, idempotencyKey }) {
  const provider = getProvider(providerId || 'neojack');

  // Evaluate and quote immediately (MVP).
  const decision = evaluateRequest({ title, body, tags, budgetUsd });

  const id = crypto.randomUUID();
  const createdAt = Date.now();

  if (!decision.accepted) {
    await run(
      `INSERT INTO requests(id, createdAt, status, title, body, tags, budgetUsd, providerId, quoteUsd, quoteMessage)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [id, createdAt, 'rejected', title, body, JSON.stringify(tags), budgetUsd || null, provider.id, null, decision.message]
    );

    return { ok: true, requestId: id, status: 'rejected', message: decision.message };
  }

  // Prepare payment-required state.
  const reference = makeReferencePubkey();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min
  const memo = makePaymentMemo({ requestId: id, reference });

  const payUrl = buildSolanaPayUrl({
    recipient: provider.solanaPayTo,
    amount: decision.quoteUsd,
    reference,
    memo,
    mint: USDC_MINT,
    label: 'Escalatex402',
    message: `Request ${id}`,
  });

  await run(
    `INSERT INTO requests(id, createdAt, status, title, body, tags, budgetUsd, providerId, quoteUsd, quoteMessage, paymentToken, payTo, paymentReference, paymentMemo)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      createdAt,
      'awaiting_payment',
      title,
      body,
      JSON.stringify(tags),
      budgetUsd || null,
      provider.id,
      decision.quoteUsd,
      decision.message,
      provider.defaultToken,
      provider.solanaPayTo,
      reference,
      memo,
    ]
  );

  const payment = build402Payload({
    requestId: id,
    amountUsd: decision.quoteUsd,
    token: provider.defaultToken,
    payTo: provider.solanaPayTo,
    reference,
    memo,
    mint: USDC_MINT,
    payUrl,
    expiresAt,
    retryUrl: `/requests/${id}`,
  });

  const out = { ok: true, requestId: id, status: 'awaiting_payment', quoteUsd: decision.quoteUsd, payment };

  if (idempotencyKey) {
    await run('INSERT OR REPLACE INTO idempotency(k, createdAt, responseJson) VALUES(?,?,?)', [
      idempotencyKey,
      Date.now(),
      JSON.stringify(out),
    ]);
  }

  return out;
}

// Capabilities document (machine-discoverable)
app.get('/.well-known/escalatex', async (_req, res) => {
  const interrupt = CFG.tiers?.find((t) => t.key === '15m') || null;

  res.json({
    protocol: 'escalatex/0.1',
    handle: CFG.handle,
    display_name: CFG.displayName,
    timezone: CFG.timezone,
    hours: {
      start: CFG.workingHours?.start || '09:00',
      end: CFG.workingHours?.end || '18:00',
      days: CFG.workingHours?.days || [1, 2, 3, 4, 5],
    },
    tiers: (CFG.tiers || []).map((t) => ({
      id: t.key,
      label: t.label,
      price: Number(t.priceUsd),
      currency: 'USDC',
      chain: 'solana',
      target: t.key === '15m' ? 'interrupt' : 'first_response',
      what_you_get: t.whatYouGet,
    })),
    max_open_requests: CFG.maxOpenRequests,
    contact: {
      telegram_chat: 'this-instance-via-openclaw',
    },
    anti_spam: {
      min_payment: Number(CFG.minPaymentUsd || '10'),
      refund_policy: 'provider_refunds_if_out_of_scope; optional_auto_refund_future',
    },
    interrupt: interrupt
      ? { id: interrupt.key, price: Number(interrupt.priceUsd), currency: 'USDC', chain: 'solana' }
      : null,
    endpoints: {
      intake: '/.well-known/escalatex',
      receipt: '/r/:id',
    },
  });
});

// Protocol endpoint: Paid escalation inbox
app.post('/.well-known/escalatex', async (req, res) => {
  const body = req.body || {};
  const title = body.subject || body.title || 'Escalation request';
  const details = body.details || body.body || '';
  const urgency = body.urgency || '';
  const desired = body.desired_sla || body.desiredSla || '';
  const tags = Array.isArray(body.tags) ? body.tags : [];

  const within = isWithinWorkingHours(new Date(), CFG);
  if (!within) {
    const interrupt = CFG.tiers?.find((t) => t.key === '15m');
    return res.status(409).json({
      ok: true,
      status: 'busy',
      handle: CFG.handle,
      next_available_at: 'next_working_hours',
      message: 'Currently outside working hours.',
      interrupt_quote: interrupt
        ? { amount: interrupt.priceUsd, currency: 'USDC', chain: 'solana', tier: interrupt.key }
        : null,
    });
  }

  const tier = CFG.tiers.find((t) => t.key === desired) || CFG.tiers[0];

  const idem = req.get('Idempotency-Key') || '';

  const created = await createRequestInternal({
    title: String(title).slice(0, 200),
    body: [details, urgency ? `Urgency: ${urgency}` : null].filter(Boolean).join('\n\n'),
    tags,
    budgetUsd: String(tier.priceUsd),
    idempotencyKey: idem || null,
  });

  // Protocol responses prefer 200 with status.
  return res.status(200).json({
    ok: true,
    status: created.status === 'awaiting_payment' ? 'requires_payment' : created.status,
    handle: CFG.handle,
    requestId: created.requestId,
    quote: created.quoteUsd ? { amount: created.quoteUsd, currency: 'USDC', chain: 'solana', tier: tier.key } : null,
    payment: created.payment || null,
    what_you_get: tier.whatYouGet,
    expires_at: created.payment?.payment?.expires_at || null,
    retry_url: created.payment?.retry_url || null,
  });
});

app.post('/requests', async (req, res) => {
  const parsed = CreateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { title, body, tags, budgetUsd, providerId } = parsed.data;
  const idem = req.get('Idempotency-Key') || '';
  const created = await createRequestInternal({
    title,
    body,
    tags,
    budgetUsd,
    providerId,
    idempotencyKey: idem || null,
  });

  const code = created.status === 'awaiting_payment' ? 201 : 200;
  return res.status(code).json(created);
});

/**
 * Get request state.
 * - If awaiting payment, returns 402 with x402 payload.
 * - If paid, returns connect info.
 */
app.get('/requests/:id', async (req, res) => {
  const row = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });

  const tags = safeJson(row.tags, []);

  if (row.status === 'awaiting_payment') {
    const payUrl = buildSolanaPayUrl({
      recipient: row.payTo,
      amount: row.quoteUsd,
      reference: row.paymentReference,
      memo: row.paymentMemo,
      mint: USDC_MINT,
      label: 'Escalatex402',
      message: `Request ${row.id}`,
    });

    const payment = build402Payload({
      requestId: row.id,
      amountUsd: row.quoteUsd,
      token: row.paymentToken,
      payTo: row.payTo,
      reference: row.paymentReference,
      memo: row.paymentMemo,
      mint: USDC_MINT,
      payUrl,
      expiresAt: null,
      retryUrl: `/requests/${row.id}`,
    });

    // x402 style: 402 with machine-readable body.
    return res.status(402).json({ ok: false, status: 'awaiting_payment', request: pickRequest(row, tags), payment });
  }

  if (row.status === 'paid') {
    return res.status(200).json({
      ok: true,
      status: 'paid',
      request: pickRequest(row, tags),
      receipt: { txSig: row.paidTxSig, paidAt: row.paidAt },
      connect: {
        type: 'telegram',
        instructions: 'Provider has been notified on Telegram. Reply in the same thread to coordinate.',
      },
    });
  }

  return res.status(200).json({ ok: true, status: row.status, request: pickRequest(row, tags), message: row.quoteMessage });
});

/**
 * Confirm payment by tx signature.
 * Verifies a USDC payment to the provider address.
 */
const ConfirmSchema = z.object({
  txSig: z.string().min(10).max(200),
});

app.post('/requests/:id/confirm-paid', async (req, res) => {
  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const row = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  if (row.status === 'paid') return res.json({ ok: true, status: 'paid' });

  // Verify on-chain.
  const expected = row.quoteUsd ? String(row.quoteUsd) : null;
  const payTo = row.payTo;
  if (!expected || !payTo) {
    return res.status(400).json({ ok: false, error: 'missing_expected_payment' });
  }

  try {
    const v = await verifyUsdcPayment({
      txSig: parsed.data.txSig,
      payTo,
      expectedAmountUsdc: expected,
      requiredMemo: row.paymentMemo,
      requiredReference: row.paymentReference,
    });

    if (!v.ok) {
      return res.status(400).json({ ok: false, error: 'verification_failed', details: v });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'verification_error', message: e?.message || String(e) });
  }

  await run(
    'UPDATE requests SET status = ?, paidTxSig = ?, paidAt = ? WHERE id = ?',
    ['paid', parsed.data.txSig, Date.now(), row.id]
  );

  console.log('[escalate402] paid+verified:', row.id, parsed.data.txSig);

  return res.json({ ok: true, status: 'paid' });
});

app.post('/requests/:id/check', async (req, res) => {
  const row = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  if (row.status === 'paid' || row.status === 'paid_notified') {
    return res.json({ ok: true, status: row.status, receipt: { txSig: row.paidTxSig, paidAt: row.paidAt } });
  }
  if (row.status !== 'awaiting_payment') {
    return res.status(400).json({ ok: false, error: 'not_awaiting_payment', status: row.status });
  }

  const { scanForPayment } = await import('./solanaScan.js');
  const expected = row.quoteUsd ? String(row.quoteUsd) : null;
  if (!expected || !row.payTo) return res.status(400).json({ ok: false, error: 'missing_expected_payment' });

  const found = await scanForPayment({
    payTo: row.payTo,
    expectedAmountUsdc: expected,
    requiredMemo: row.paymentMemo,
    requiredReference: row.paymentReference,
    limit: 25,
  });

  if (!found.ok) {
    return res.status(404).json({ ok: false, status: 'awaiting_payment', scan: found });
  }

  await run(
    'UPDATE requests SET status = ?, paidTxSig = ?, paidAt = ? WHERE id = ?',
    ['paid', found.txSig, Date.now(), row.id]
  );

  return res.json({ ok: true, status: 'paid', receipt: { txSig: found.txSig } });
});

app.get('/admin/requests', async (req, res) => {
  const rows = await all('SELECT id, createdAt, status, title, providerId, quoteUsd, paidAt FROM requests ORDER BY createdAt DESC LIMIT 50');
  res.json({ ok: true, requests: rows });
});

function safeJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function pickRequest(row, tags) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    title: row.title,
    body: row.body,
    tags,
    budgetUsd: row.budgetUsd,
    providerId: row.providerId,
    quoteUsd: row.quoteUsd,
    quoteMessage: row.quoteMessage,
  };
}

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[escalatex402] listening on :${port}`);
});
