import { NextRequest } from 'next/server';
import { discoverTopic } from '@/lib/agents/scout';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/* Topic/entity discovery via Google News — powers entity follows and
   the follow-preview. No Gemini calls; fetchGNews caches per feed.  */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const edition = req.nextUrl.searchParams.get('edition') || 'US:en';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '8', 10), 15);

  if (!q || q.length < 2) {
    return Response.json({ error: 'q is required' }, { status: 400 });
  }

  const { allowed, retryAfter } = checkRateLimit(getIp(req), 20);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const items = await discoverTopic(q, edition, limit);
  return Response.json({ q, edition, items });
}
