import { NextRequest } from 'next/server';
import { sendToHour, HAS_PUSH } from '@/lib/push';
import { buildBriefing } from '@/lib/briefing';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  return req.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
}

/* Called hourly (GitHub Actions) — delivers the morning brief's top
   story to subscriptions whose chosen local hour matches now (UTC). */
async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!HAS_PUSH) {
    return Response.json({ error: 'Push not configured' }, { status: 503 });
  }

  const hourUtc = new Date().getUTCHours();

  const stats = await sendToHour(hourUtc, async (edition) => {
    const brief = await buildBriefing(edition, 'English', 5);
    const top = brief.stories[0];
    if (!top) return null;
    return {
      title: `☀️ Your Brève brief`,
      body: top.title,
      url: '/',
    };
  });

  return Response.json({ hourUtc, ...stats });
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
