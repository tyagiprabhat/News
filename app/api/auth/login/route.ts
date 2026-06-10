import { checkCredentials, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(`login:${getIp(req)}`, 5);
  if (!allowed) {
    return Response.json(
      { error: 'Too many attempts — try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { username, password } = await req.json().catch(() => ({}));

  if (!username || !password || !checkCredentials(username, password)) {
    return Response.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const token = await createSessionToken(username.trim().toLowerCase());
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
      },
    }
  );
}
