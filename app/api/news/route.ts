import { fetchNewsFeed } from '@/lib/news';
import type { NewsItem } from '@/lib/news';
import { NextRequest } from 'next/server';
import { cacheGet, cacheSet } from '@/lib/cache';
import { query, HAS_DB } from '@/lib/db';
import { fetchGNews, topFeedUrl, getEdition } from '@/lib/gnews';

export const runtime = 'nodejs';
export const revalidate = 300;

const DB_CACHE_TTL = 30 * 60;   // 30 min
const GNEWS_CACHE_TTL = 15 * 60; // 15 min

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
  coverage_count: number;
  country_count: number;
}

function rowToNewsItem(row: ProcessedStoryRow): NewsItem & {
  _fromDB: true;
  _conflictFlag: boolean;
  _storyId: string;
  _clusterSize: number;
  _countries: number;
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
    _clusterSize: row.source_keys.length + Number(row.coverage_count ?? 0),
    _countries: Number(row.country_count ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('source') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '8', 10);
  const edition = req.nextUrl.searchParams.get('edition') || 'US:en';
  const isDefaultEdition = !edition || edition === 'US:en';

  // 1. DB-sourced stories (default edition only — DB has curated content)
  if (HAS_DB && isDefaultEdition) {
    const cacheKey = `db:stories:v2:${category ?? 'all'}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return Response.json({ items: JSON.parse(cached), fetchedAt: new Date().toISOString(), source: 'db-cache' });
    }
    try {
      const whereClause = category && category !== 'all'
        ? 'WHERE expires_at > NOW() AND category = $2'
        : 'WHERE expires_at > NOW()';
      const params: unknown[] = category && category !== 'all' ? [limit, category] : [limit];
      const rows = await query<ProcessedStoryRow>(
        `SELECT ps.id, ps.title, ps.summary, ps.category, ps.region,
                ps.source_keys, ps.source_names, ps.primary_url, ps.image_url,
                ps.conflict_flag, ps.published_at,
                (SELECT COUNT(*) FROM cluster_coverage cc WHERE cc.cluster_id = ps.cluster_id) AS coverage_count,
                (SELECT COUNT(DISTINCT cc.country) FROM cluster_coverage cc WHERE cc.cluster_id = ps.cluster_id) AS country_count
         FROM processed_stories ps ${whereClause}
         ORDER BY ps.published_at DESC LIMIT $1`,
        params
      );
      if (rows.length >= 3) {
        const items = rows.map(rowToNewsItem);
        await cacheSet(cacheKey, JSON.stringify(items), DB_CACHE_TTL);
        return Response.json({ items, fetchedAt: new Date().toISOString(), source: 'db' });
      }
    } catch { /* fall through */ }
  }

  // 2. Non-default edition — Google News RSS + curated interleave
  if (!isDefaultEdition) {
    const ed = getEdition(edition);
    const cacheKey = `gnews:v1:${edition}:${category ?? 'all'}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return Response.json({ items: JSON.parse(cached), fetchedAt: new Date().toISOString(), source: 'gnews-cache' });
    }
    try {
      const gnItems = await fetchGNews(topFeedUrl(ed), Math.ceil(limit * 0.7));
      gnItems.forEach(i => { i.sourceFlag = ed.flag; i.region = ed.region; });

      // Blend in curated items from the same region for image-backed cards
      const curatedItems = await fetchNewsFeed(undefined, Math.ceil(limit * 0.4));
      const regionMatch = curatedItems.filter(i => i.region === ed.region);
      const items = interleaveEdition(gnItems, regionMatch, limit);

      if (items.length > 0) {
        await cacheSet(cacheKey, JSON.stringify(items), GNEWS_CACHE_TTL);
        return Response.json({ items, fetchedAt: new Date().toISOString(), source: 'gnews', edition });
      }
    } catch { /* fall through to RSS */ }
  }

  // 3. Fallback: live curated RSS (original behaviour)
  try {
    const items = await fetchNewsFeed(category, Math.min(limit, 15));
    return Response.json({ items, fetchedAt: new Date().toISOString(), source: 'rss' });
  } catch {
    return Response.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}

// Interleave Google News items with curated items (curated = better images/snippets)
function interleaveEdition(gnews: NewsItem[], curated: NewsItem[], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  const maxCurated = Math.floor(limit * 0.3);
  let ci = 0;
  for (const item of gnews) {
    if (result.length >= limit) break;
    if (!seen.has(item.link)) { seen.add(item.link); result.push(item); }
    // Splice in a curated item every 3 gnews items
    if (ci < maxCurated && result.length % 3 === 0) {
      while (ci < curated.length) {
        const c = curated[ci++];
        if (!seen.has(c.link)) { seen.add(c.link); result.push(c); break; }
      }
    }
  }
  return result.slice(0, limit);
}
