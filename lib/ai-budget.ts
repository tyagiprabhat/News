import { kv } from '@vercel/kv';

/* ── Daily Gemini budget meter ──────────────────────────────────────
   KV INCR with midnight-UTC expiry per feature. Keeps the app inside
   the free-tier RPD limits; callers degrade to non-LLM fallbacks when
   a feature's budget is exhausted. Always-allow when KV is absent.  */

const HAS_KV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

const CAPS: Record<string, number> = {
  summarize: 500,  // flash-lite — card summaries (KV-cached globally)
  newsroom: 150,   // 2 lite + 1 flash per run
  chat: 120,       // flash
  brief: 30,       // 1 flash per edition+lang per day
  translate: 50,
  qa: 150,
  embed: 600,
};

export async function tryConsume(feature: string): Promise<boolean> {
  if (!HAS_KV) return true; // dev / pre-KV: never block
  const date = new Date().toISOString().slice(0, 10);
  const key = `budget:${feature}:${date}`;
  try {
    const n = await kv.incr(key);
    if (n === 1) {
      // Expire at next UTC midnight
      const secondsToMidnight = Math.ceil((Date.parse(`${date}T24:00:00Z`) - Date.now()) / 1000);
      await kv.expire(key, Math.max(secondsToMidnight, 60));
    }
    return n <= (CAPS[feature] ?? 100);
  } catch {
    return true; // KV hiccup: don't block the product
  }
}
