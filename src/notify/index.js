import { telegramNotifier } from './telegram.js';

export function getNotifiersFromEnv() {
  const list = [];
  const tg = telegramNotifier();
  if (tg) list.push(tg);
  return list;
}

export async function notifyAll({ notifiers, event, payload }) {
  const results = [];
  for (const n of notifiers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await n.notify(event, payload);
      results.push({ ok: true, provider: n.name, result: r });
    } catch (e) {
      results.push({ ok: false, provider: n.name, error: e?.message || String(e) });
    }
  }
  return results;
}

export function anyNotifierConfigured(notifiers) {
  return Array.isArray(notifiers) && notifiers.length > 0;
}
