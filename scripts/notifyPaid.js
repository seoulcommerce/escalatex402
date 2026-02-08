import { all, run } from '../src/db.js';

// This script is intended to be run by OpenClaw (cron) and then it will send Telegram
// messages from the agent harness. The actual sending happens outside this script.

export async function getUnnotifiedPaid() {
  return all(
    'SELECT id, title, quoteUsd, providerId, paidTxSig, paidAt FROM requests WHERE status = ? AND (paidAt IS NOT NULL) ORDER BY paidAt ASC LIMIT 25',
    ['paid']
  );
}

export async function markNotified(id) {
  // Add a soft marker by updating status -> paid_notified (keeps semantics simple).
  return run('UPDATE requests SET status = ? WHERE id = ?', ['paid_notified', id]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await getUnnotifiedPaid();
  console.log(JSON.stringify({ ok: true, count: rows.length, rows }, null, 2));
}
