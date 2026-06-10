import { fetchNewsFeed } from '@/lib/news';
import type { NewsItem } from '@/lib/news';
import { NextRequest } from 'next/server';
import { cacheGet, cacheSet } from '@/lib/cache';
import { query, HAS_DB } from '@/lib/db';

export const runtime = 'nodejs';
export const revalidate = 300;

const DB_CACHE_TTL = 30 * 60; // 30 minutes

interface ProcessedStoryRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  region: string;
  source_keys: string[];
  source_names: string[];
  primary_url: string;
  image_url: string | null;
  conflict_flag: boolean;
  published_at: string;
}

function rowToNewsItem(row: ProcessedStoryRow): NewsItem & {
  _fromDB: true;
  _conflictFlag: boolean;
  _storyId: string;
} {
  return {
    title: row.title,
    link: row.primary_url,
    pubDate: row.published_at,
    contentSnippet: row.summary,
    imageUrl: row.image_url ?? undefined,
    category: row.category,
    region: row.region,
    source: row.source_keys[0] ?? 'db',
    sourceName: row.source_names.join(', '),
    sourceFlag: '✦',
    _fromDB: true,
    _conflictFlag: row.conflict_flag,
    _storyId: row.id,
  };
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('source') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '8', 10);

  // 1. Try DB-sourced stories (with KV cache layer)
  if (HAS_DB) {
    const cacheKey = `db:stories:v1:${category ?? 'all'}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return Response.json({ items: JSON.parse(cached), fetchedAt: new Date().toISOString(), source: 'db-cache' });
    }

    try {
      const whereClause = category && category !== 'all'
        ? `WHERE expires_at > NOW() AND category = $2`
        : `WHERE expires_at > NOW()`;
      const params: unknown[] = category && category !== 'all' ? [limit, category] : [limit];

      const rows = await query<ProcessedStoryRow>(
        `SELECT id, title, summary, category, region,
                source_keys, source_names, primary_url, image_url,
                conflict_flag, published_at
         FROM processed_stories
         ${whereClause}
         ORDER BY published_at DESC
         LIMIT $1`,
        params
      );

      if (rows.length >= 3) {
        const items = rows.map(rowToNewsItem);
        await cacheSet(cacheKey, JSON.stringify(items), DB_CACHE_TTL);
        return Response.json({ items, fetchedAt: new Date().toISOString(), source: 'db' });
      }
    } catch {
      // Fall through to RSS if DB query fails
    }
  }

  // 2. Fallback: live RSS feed (existing behaviour, unchanged)
  try {
    const items = await fetchNewsFeed(category, Math.min(limit, 15));
    return Response.json({ items, fetchedAt: new Date().toISOString(), source: 'rss' });
  } catch {
    return Response.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
