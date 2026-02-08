import fs from 'fs';

const DEFAULT = {
  handle: process.env.ESCALATEX_HANDLE || 'neojack',
  displayName: process.env.ESCALATEX_DISPLAY_NAME || 'Neojack',
  timezone: process.env.ESCALATEX_TZ || 'UTC',
  workingHours: {
    // 24h clock, best-effort for hackathon.
    startHour: Number(process.env.ESCALATEX_START_HOUR || 9),
    endHour: Number(process.env.ESCALATEX_END_HOUR || 18),
  },
  tiers: [
    { key: '24h', label: '24h response', priceUsd: '10', whatYouGet: 'Priority review + response within 24h.' },
    { key: '2h', label: '2h response', priceUsd: '50', whatYouGet: 'Priority review + response within 2h.' },
    { key: '15m', label: '15m interrupt', priceUsd: '200', whatYouGet: 'Interrupt tier. You jump the queue (best-effort).' },
  ],
  minPaymentUsd: process.env.ESCALATEX_MIN_USD || '10',
  maxOpenRequests: Number(process.env.ESCALATEX_MAX_OPEN || 5),
};

export function loadConfig() {
  const path = process.env.ESCALATEX_CONFIG_PATH || './escalatex.config.json';
  try {
    if (fs.existsSync(path)) {
      const raw = fs.readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT;
}
