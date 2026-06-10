import { kv } from '@vercel/kv';
import { gzipSync, gunzipSync } from 'zlib';

// Durable cache for AI summaries. Uses Vercel KV (Redis) in production once
// KV_REST_API_URL / KV_REST_API_TOKEN are set; otherwise falls back to an
// in-memory map so the app keeps working before KV is linked.
// Values are gzip-compressed and base64-encoded before storage (~3x smaller).
const HAS_KV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// Prefix distinguishes compressed entries from any legacy plain-text ones.
const GZ_PREFIX = 'gz:';

function compress(text: string): string {
  return GZ_PREFIX + gzipSync(Buffer.from(text, 'utf8')).toString('base64');
}

function decompress(stored: string): string {
  if (!stored.startsWith(GZ_PREFIX)) return stored;
  return gunzipSync(Buffer.from(stored.slice(GZ_PREFIX.length), 'base64')).toString('utf8');
}

const mem = new Map<string, { value: string; expiresAt: number }>();

export async function cacheGet(key: string): Promise<string | null> {
  if (HAS_KV) {
    try {
      const stored = await kv.get<string>(key);
      return stored ? decompress(stored) : null;
    } catch {
      return null;
    }
  }
  const entry = mem.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  if (entry) mem.delete(key);
  return null;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (HAS_KV) {
    try {
      await kv.set(key, compress(value), { ex: ttlSeconds });
    } catch {
      // ignore cache write failures
    }
    return;
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// Stable, compact key for a summary variant of an article.
export function summaryKey(link: string, language: string, words: number): string {
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    hash = (hash << 5) - hash + link.charCodeAt(i);
    hash |= 0;
  }
  return `sum:${language.toLowerCase()}:${words}:${(hash >>> 0).toString(36)}`;
}
