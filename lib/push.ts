import webpush from 'web-push';
import { query, HAS_DB } from '@/lib/db';

/* ── Web Push (VAPID, free) ─────────────────────────────────────────
   Silently disabled until VAPID keys are set:
   npx web-push generate-vapid-keys                                  */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@breve.news';

export const HAS_PUSH = !!VAPID_PUBLIC && !!VAPID_PRIVATE && HAS_DB;

if (HAS_PUSH) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  edition: string;
  send_hour_utc: number;
}

export async function saveSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}, edition: string, sendHourUtc: number, userId?: string | null): Promise<void> {
  if (!HAS_DB) return;
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, edition, send_hour_utc)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET
       edition = EXCLUDED.edition,
       send_hour_utc = EXCLUDED.send_hour_utc,
       failures = 0`,
    [userId ?? null, sub.endpoint, sub.keys.p256dh, sub.keys.auth, edition, sendHourUtc]
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (!HAS_DB) return;
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

/* Send a payload to every subscription matching the given UTC hour.
   Prunes dead endpoints (404/410). Returns delivery stats.        */
export async function sendToHour(hourUtc: number, payloadForEdition: (edition: string) => Promise<{
  title: string; body: string; url: string;
} | null>): Promise<{ sent: number; pruned: number; failed: number }> {
  if (!HAS_PUSH) return { sent: 0, pruned: 0, failed: 0 };

  const subs = await query<PushSubscriptionRow>(
    'SELECT id, endpoint, p256dh, auth, edition, send_hour_utc FROM push_subscriptions WHERE send_hour_utc = $1 AND failures < 5',
    [hourUtc]
  );

  let sent = 0, pruned = 0, failed = 0;
  const payloadCache = new Map<string, string | null>();

  for (const sub of subs) {
    let payload = payloadCache.get(sub.edition);
    if (payload === undefined) {
      const p = await payloadForEdition(sub.edition);
      payload = p ? JSON.stringify(p) : null;
      payloadCache.set(sub.edition, payload);
    }
    if (!payload) continue;

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await removeSubscription(sub.endpoint);
        pruned++;
      } else {
        await query('UPDATE push_subscriptions SET failures = failures + 1 WHERE endpoint = $1', [sub.endpoint]);
        failed++;
      }
    }
  }
  return { sent, pruned, failed };
}
