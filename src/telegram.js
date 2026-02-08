import fetch from 'node-fetch';

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function telegramSend(text) {
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

export function formatPaidNotification({ requestId, title, quoteUsd, txSig, receiptUrl }) {
  const parts = [];
  parts.push(`Escalatex402: paid request ✅`);
  parts.push(`ID: ${requestId}`);
  parts.push(`Title: ${title}`);
  if (quoteUsd) parts.push(`Tier/Quote: ${quoteUsd} USDC`);
  if (txSig) parts.push(`Tx: ${txSig}`);
  if (receiptUrl) parts.push(`Receipt: ${receiptUrl}`);
  return parts.join('\n');
}
