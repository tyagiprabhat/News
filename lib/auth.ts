// Lightweight credential auth for a small invite-only user base.
// Users live in the AUTH_USERS env var as "alice:password1,bob:password2".
// Sessions are HMAC-signed HTTP-only cookies — no database required.
// Uses Web Crypto only, so verification also runs in Edge middleware.

export const SESSION_COOKIE = 'newsai_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET env var is not set');
  return secret;
}

export function parseUsers(): Map<string, string> {
  const raw = process.env.AUTH_USERS || '';
  const users = new Map<string, string>();
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':');
    if (idx > 0) {
      users.set(pair.slice(0, idx).trim().toLowerCase(), pair.slice(idx + 1).trim());
    }
  }
  return users;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkCredentials(username: string, password: string): boolean {
  const expected = parseUsers().get(username.trim().toLowerCase());
  return !!expected && timingSafeEqual(expected, password);
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(sig));
}

export async function createSessionToken(username: string): Promise<string> {
  const payload = `${username}|${Date.now() + SESSION_TTL_MS}`;
  const encoded = base64url(new TextEncoder().encode(payload));
  return `${encoded}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    payload = atob(b64);
  } catch {
    return null;
  }
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  const [username, expires] = payload.split('|');
  if (!username || !expires || Date.now() > Number(expires)) return null;
  return username;
}
