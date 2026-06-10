import { auth } from '@clerk/nextjs/server';
import { query, HAS_DB } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLERK_ENABLED = !!process.env.CLERK_SECRET_KEY;

/* Server mirror of client prefs for signed-in users.
   Returns 204 when Clerk or DB isn't configured, or user is signed out —
   the client treats 204 as "localStorage only" and carries on.        */

async function getUserId(): Promise<string | null> {
  if (!CLERK_ENABLED) return null;
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await getUserId();
  if (!userId || !HAS_DB) return new Response(null, { status: 204 });

  try {
    const rows = await query<{
      edition: string; lang: string; follows: unknown; affinity: unknown; streak: unknown;
    }>(
      'SELECT edition, lang, follows, affinity, streak FROM user_prefs WHERE user_id = $1',
      [userId]
    );
    if (rows.length === 0) return new Response(null, { status: 204 });
    return Response.json(rows[0]);
  } catch {
    return new Response(null, { status: 204 });
  }
}

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId || !HAS_DB) return new Response(null, { status: 204 });

  try {
    const body = await req.json();
    const { edition, lang, follows, affinity, streak } = body ?? {};
    await query(
      `INSERT INTO user_prefs (user_id, edition, lang, follows, affinity, streak, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         edition = EXCLUDED.edition,
         lang = EXCLUDED.lang,
         follows = EXCLUDED.follows,
         affinity = EXCLUDED.affinity,
         streak = EXCLUDED.streak,
         updated_at = NOW()`,
      [
        userId,
        typeof edition === 'string' ? edition.slice(0, 8) : 'US:en',
        typeof lang === 'string' ? lang.slice(0, 24) : 'English',
        JSON.stringify(Array.isArray(follows) ? follows.slice(0, 50) : []),
        JSON.stringify(affinity ?? {}),
        JSON.stringify(streak ?? {}),
      ]
    );
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
