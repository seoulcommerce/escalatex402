import fetch from 'node-fetch';

function configured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function telegramNotifier() {
  if (!configured()) return null;

  return {
    name: 'telegram',

    async notify(event, payload) {
      if (event === 'paid') {
        return send(formatPaid(payload));
      }
      if (event === 'test') {
        return send(payload.text || 'Escalatex test notification');
      }
      return { ok: true, skipped: true };
    },
  };
}

async function send(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, skipped: true };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    return { ok: false, status: res.status, json };
  }

  return { ok: true, result: json.result };
}

function formatPaid({ requestId, title, quoteUsd, txSig, receiptUrl }) {
  const parts = [];
  parts.push(`Escalatex: paid request ✅`);
  parts.push(`ID: ${requestId}`);
  parts.push(`Title: ${title}`);
  if (quoteUsd) parts.push(`Tier/Quote: ${quoteUsd} USDC`);
  if (txSig) parts.push(`Tx: ${txSig}`);
  if (receiptUrl) parts.push(`Receipt: ${receiptUrl}`);
  return parts.join('\n');
}
