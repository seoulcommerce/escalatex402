import fs from 'fs';

// This project started as a hackathon MVP with a simple config shape.
// We keep that legacy shape because server.js expects it (handle, displayName, workingHours, tiers[*].key/priceUsd).

const DEFAULT = {
  handle: process.env.ESCALATEX_HANDLE || 'neojack',
  displayName: process.env.ESCALATEX_DISPLAY_NAME || 'Neojack',
  timezone: process.env.ESCALATEX_TZ || 'UTC',
  workingHours: {
    start: process.env.ESCALATEX_START || '09:00',
    end: process.env.ESCALATEX_END || '18:00',
    days: [1, 2, 3, 4, 5],
    // internal computation still uses these fallback hours
    startHour: Number(process.env.ESCALATEX_START_HOUR || 0),
    endHour: Number(process.env.ESCALATEX_END_HOUR || 24),
  },
  tiers: [
    { key: '24h', label: '24h response', priceUsd: '10', whatYouGet: 'Priority review + response within 24h.' },
    { key: '2h', label: '2h response', priceUsd: '50', whatYouGet: 'Priority review + response within 2h.' },
    { key: '15m', label: '15m interrupt', priceUsd: '200', whatYouGet: 'Interrupt tier. You jump the queue (best-effort).' },
  ],
  minPaymentUsd: process.env.ESCALATEX_MIN_USD || '10',
  maxOpenRequests: Number(process.env.ESCALATEX_MAX_OPEN || 5),
};

function readConfigFile() {
  const p = process.env.ESCALATEX_CONFIG || process.env.ESCALATEX_CONFIG_PATH || './escalatex.config.json';
  try {
    if (p && fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeFromFile(file) {
  if (!file) return null;

  // New-style file format (productization):
  // { provider{handle,display_name,timezone}, availability{days,start,end}, limits{max_open_requests}, tiers[{id,label,amount_usdc,target}] }
  if (file.provider || file.availability || file.limits || Array.isArray(file.tiers)) {
    const handle = file.provider?.handle;
    const displayName = file.provider?.display_name;
    const timezone = file.provider?.timezone;

    const workingHours = file.availability
      ? {
          days: file.availability.days,
          start: file.availability.start,
          end: file.availability.end,
        }
      : null;

    const tiers = Array.isArray(file.tiers)
      ? file.tiers.map((t) => {
          // map new tier to legacy tier shape
          const key = t.id === 'interrupt' ? '15m' : t.id;
          return {
            key,
            label: t.label,
            priceUsd: String(t.amount_usdc),
            whatYouGet: t.what_you_get || t.whatYouGet,
          };
        })
      : null;

    return {
      handle,
      displayName,
      timezone,
      workingHours,
      tiers,
      maxOpenRequests: file.limits?.max_open_requests,
    };
  }

  // Otherwise assume legacy format; allow shallow merge.
  return file;
}

export function loadConfig() {
  const fileRaw = readConfigFile();
  const file = normalizeFromFile(fileRaw);

  const merged = { ...DEFAULT, ...(file || {}) };
  merged.workingHours = { ...DEFAULT.workingHours, ...(file?.workingHours || file?.working_hours || file?.availability || {}) };

  // env vars always win for key identity
  merged.handle = process.env.ESCALATEX_HANDLE || merged.handle;
  merged.displayName = process.env.ESCALATEX_DISPLAY_NAME || merged.displayName;
  merged.timezone = process.env.ESCALATEX_TZ || merged.timezone;

  // max open
  merged.maxOpenRequests = Number(process.env.ESCALATEX_MAX_OPEN || merged.maxOpenRequests || DEFAULT.maxOpenRequests);

  // tiers: ensure legacy shape exists
  if (!Array.isArray(merged.tiers) || merged.tiers.length === 0) merged.tiers = DEFAULT.tiers;

  return merged;
}
