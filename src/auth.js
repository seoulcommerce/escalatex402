import crypto from 'crypto';
import { get, run } from './db.js';
import { notifyAll, anyNotifierConfigured, getNotifiersFromEnv } from './notify/index.js';

const COOKIE_NAME = 'escalatex_session';

function now() {
  return Date.now();
}

function baseUrlFromEnv() {
  const b = process.env.PUBLIC_BASE_URL || '';
  return b ? b.replace(/\/$/, '') : '';
}

export function authEnabled() {
  return Boolean(process.env.AUTH_ENABLED === '1' || process.env.AUTH_ENABLED === 'true' || process.env.AUTH_SECRET);
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function createLoginToken() {
  const token = crypto.randomBytes(24).toString('hex');
  const ttlMs = Number(process.env.LOGIN_TOKEN_TTL_MS || 10 * 60 * 1000);
  await run('INSERT INTO login_tokens(token, createdAt, expiresAt, usedAt) VALUES(?,?,?,NULL)', [token, now(), now() + ttlMs]);
  return { token, expiresAt: now() + ttlMs };
}

export async function consumeLoginToken(token) {
  const row = await get('SELECT token, expiresAt, usedAt FROM login_tokens WHERE token = ?', [token]);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.usedAt) return { ok: false, reason: 'already_used' };
  if (row.expiresAt < now()) return { ok: false, reason: 'expired' };
  await run('UPDATE login_tokens SET usedAt = ? WHERE token = ?', [now(), token]);
  return { ok: true };
}

export async function createSession() {
  const id = crypto.randomBytes(24).toString('hex');
  const ttlMs = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
  await run('INSERT INTO sessions(id, createdAt, expiresAt) VALUES(?,?,?)', [id, now(), now() + ttlMs]);
  return { id, expiresAt: now() + ttlMs };
}

export async function getSession(sessionId) {
  if (!sessionId) return null;
  const row = await get('SELECT id, expiresAt FROM sessions WHERE id = ?', [sessionId]);
  if (!row) return null;
  if (row.expiresAt < now()) return null;
  return row;
}

export async function requestLoginLink() {
  const NOTIFIERS = getNotifiersFromEnv();
  if (!anyNotifierConfigured(NOTIFIERS)) {
    return { ok: false, error: 'no_notifiers_configured' };
  }

  const { token, expiresAt } = await createLoginToken();
  const base = baseUrlFromEnv();
  if (!base) {
    return { ok: false, error: 'missing_PUBLIC_BASE_URL' };
  }
  const link = `${base}/auth/callback?token=${token}`;

  const text = [
    'Escalatex login link',
    '',
    `Link (expires ${new Date(expiresAt).toISOString()}):`,
    link,
    '',
    'If you did not request this, ignore it.',
  ].join('\n');

  const results = await notifyAll({ notifiers: NOTIFIERS, event: 'test', payload: { text } });
  return { ok: true, results };
}
