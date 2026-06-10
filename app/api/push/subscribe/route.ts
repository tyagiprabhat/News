import { saveSubscription, removeSubscription, HAS_PUSH } from '@/lib/push';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!HAS_PUSH) return new Response(null, { status: 204 });

  const { allowed } = checkRateLimit(getIp(req), 10);
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429 });

  try {
    const { subscription, edition, sendHourUtc } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 });
    }
    const hour = Number.isInteger(sendHourUtc) && sendHourUtc >= 0 && sendHourUtc <= 23
      ? sendHourUtc : 7;
    await saveSubscription(subscription, typeof edition === 'string' ? edition.slice(0, 8) : 'US:en', hour);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Subscription failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!HAS_PUSH) return new Response(null, { status: 204 });
  try {
    const { endpoint } = await req.json();
    if (endpoint) await removeSubscription(endpoint);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}
