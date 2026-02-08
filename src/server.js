import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { z } from 'zod';

import { initDb, run, get, all } from './db.js';
import { getProvider, evaluateRequest } from './providers.js';
import { build402Payload } from './x402.js';

initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
app.post('/requests', async (req, res) => {
  const parsed = CreateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { title, body, tags, budgetUsd, providerId } = parsed.data;
  const provider = getProvider(providerId || 'neojack');

  // Evaluate and quote immediately (MVP). In later versions, this could be async/agent-driven.
  const decision = evaluateRequest({ title, body, tags, budgetUsd });

  const id = crypto.randomUUID();
  const createdAt = Date.now();

  if (!decision.accepted) {
    await run(
      `INSERT INTO requests(id, createdAt, status, title, body, tags, budgetUsd, providerId, quoteUsd, quoteMessage)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [id, createdAt, 'rejected', title, body, JSON.stringify(tags), budgetUsd || null, provider.id, null, decision.message]
    );

    return res.status(200).json({ ok: true, requestId: id, status: 'rejected', message: decision.message });
  }

  // Prepare payment-required state.
  const reference = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

  await run(
    `INSERT INTO requests(id, createdAt, status, title, body, tags, budgetUsd, providerId, quoteUsd, quoteMessage, paymentToken, payTo, paymentReference)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    ]
  );

  const payment = build402Payload({
    requestId: id,
    amountUsd: decision.quoteUsd,
    token: provider.defaultToken,
    payTo: provider.solanaPayTo,
    reference,
    expiresAt,
  });

  return res.status(201).json({ ok: true, requestId: id, status: 'awaiting_payment', quoteUsd: decision.quoteUsd, payment });
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
    const payment = build402Payload({
      requestId: row.id,
      amountUsd: row.quoteUsd,
      token: row.paymentToken,
      payTo: row.payTo,
      reference: row.paymentReference,
      expiresAt: null,
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
 * MVP: manual payment confirmation endpoint.
 * In production this would verify on-chain USDC/SOL transfer.
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

  await run(
    'UPDATE requests SET status = ?, paidTxSig = ?, paidAt = ? WHERE id = ?',
    ['paid', parsed.data.txSig, Date.now(), row.id]
  );

  // Notification is intentionally not implemented here yet; we’ll integrate OpenClaw/Telegram next.
  console.log('[escalate402] paid:', row.id, parsed.data.txSig);

  return res.json({ ok: true, status: 'paid' });
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
  console.log(`[escalate402] listening on :${port}`);
});
