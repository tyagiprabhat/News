import { fetchNewsFeed } from '@/lib/news';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 minutes

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get('source') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '8', 10);

  try {
    const items = await fetchNewsFeed(source, Math.min(limit, 20));
    return Response.json({ items, fetchedAt: new Date().toISOString() });
  } catch {
    return Response.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
