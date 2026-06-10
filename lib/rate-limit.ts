const WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory per-IP buckets — one Map per limit tier
const buckets = new Map<string, Bucket>();

// Purge stale entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}, 5 * 60_000);

export function checkRateLimit(ip: string, max: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const key = `${ip}:${max}`;
  let b = buckets.get(key);

  if (!b || now > b.resetAt) {
    b = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
    return { allowed: true, retryAfter: 0 };
  }

  if (b.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }

  b.count++;
  return { allowed: true, retryAfter: 0 };
}

export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  );
}
