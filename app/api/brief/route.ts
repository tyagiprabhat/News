import { NextRequest } from 'next/server';
import { buildBriefing } from '@/lib/briefing';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/* Today's 5-story digest — the morning-brief habit anchor.
   One Gemini call per edition+language per day (KV-cached). */
export async function GET(req: NextRequest) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 20);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const edition = req.nextUrl.searchParams.get('edition') || 'US:en';
  const language = req.nextUrl.searchParams.get('lang') || 'English';

  const briefing = await buildBriefing(edition, language, 5);
  return Response.json(briefing, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
