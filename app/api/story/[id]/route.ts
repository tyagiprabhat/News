import { NextRequest } from 'next/server';
import { query, HAS_DB } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';
import { profileSource } from '@/lib/news';

export const runtime = 'nodejs';

const STORY_CACHE_TTL = 30 * 60;

/* Cluster detail for a processed story: member articles + global
   coverage discovered by the Scout, grouped for the CoverageBar. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!HAS_DB) return Response.json({ error: 'Not available' }, { status: 404 });

  const id = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const cacheKey = `story:v1:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached));
  }

  try {
    const stories = await query<{
      id: string; cluster_id: string; title: string; summary: string;
      source_keys: string[]; source_names: string[]; primary_url: string;
      published_at: string;
    }>(
      `SELECT id, cluster_id, title, summary, source_keys, source_names, primary_url, published_at
       FROM processed_stories WHERE id = $1`,
      [id]
    );
    if (stories.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const story = stories[0];

    const [members, coverage] = await Promise.all([
      query<{ source_key: string; source_name: string; title: string; url: string; pub_date: string }>(
        `SELECT source_key, source_name, title, url, pub_date
         FROM articles WHERE cluster_id = $1 ORDER BY pub_date DESC LIMIT 12`,
        [story.cluster_id]
      ),
      query<{ publisher: string; title: string; url: string; country: string | null; pub_date: string | null }>(
        `SELECT publisher, title, url, country, pub_date
         FROM cluster_coverage WHERE cluster_id = $1 ORDER BY discovered_at DESC LIMIT 20`,
        [story.cluster_id]
      ),
    ]);

    // Group curated members by outlet type, coverage by country
    const byType: Record<string, { name: string; title: string; url: string }[]> = {};
    for (const m of members) {
      const type = profileSource(m.source_key)?.profile.type ?? 'News Outlet';
      (byType[type] ??= []).push({ name: m.source_name, title: m.title, url: m.url });
    }
    const byCountry: Record<string, { publisher: string; title: string; url: string }[]> = {};
    for (const c of coverage) {
      const key = c.country || 'global';
      (byCountry[key] ??= []).push({ publisher: c.publisher, title: c.title, url: c.url });
    }

    const outlets = new Set([
      ...members.map(m => m.source_name),
      ...coverage.map(c => c.publisher),
    ]);

    const payload = {
      id: story.id,
      title: story.title,
      summary: story.summary,
      primaryUrl: story.primary_url,
      publishedAt: story.published_at,
      outletCount: outlets.size,
      countryCount: Object.keys(byCountry).length,
      byType,
      byCountry,
    };

    await cacheSet(cacheKey, JSON.stringify(payload), STORY_CACHE_TTL);
    return Response.json(payload);
  } catch {
    return Response.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
