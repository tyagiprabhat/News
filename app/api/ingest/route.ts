import { NextRequest } from 'next/server';
import { fetchNewsFeed } from '@/lib/news';
import { embedTexts, toVectorLiteral, isDuplicate, findNearestCluster, updateClusterCentroid } from '@/lib/embeddings';
import { query, HAS_DB } from '@/lib/db';
import { expandStory } from '@/lib/agents/scout';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${CRON_SECRET}`;
}

interface IngestStats {
  fetched: number;
  embedded: number;
  duplicates: number;
  inserted: number;
  clustersCreated: number;
  clustersUpdated: number;
  coverageExpanded: number;
  errors: string[];
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!HAS_DB) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  const startTime = Date.now();
  const stats: IngestStats = {
    fetched: 0,
    embedded: 0,
    duplicates: 0,
    inserted: 0,
    clustersCreated: 0,
    clustersUpdated: 0,
    coverageExpanded: 0,
    errors: [],
  };

  try {
    // 1. Fetch all RSS feeds
    const items = await fetchNewsFeed(undefined, 15);
    stats.fetched = items.length;

    // 2. Filter items that have URLs
    const validItems = items.filter(item => item.link);

    // 3. Quick URL-dedup pass before embedding (saves API calls)
    const toEmbed: typeof validItems = [];
    for (const item of validItems) {
      const urlExists = await query<{ id: string }>(
        'SELECT id FROM articles WHERE url = $1 LIMIT 1',
        [item.link]
      );
      if (urlExists.length === 0) toEmbed.push(item);
      else stats.duplicates++;
    }

    if (toEmbed.length === 0) {
      return Response.json({ stats, durationMs: Date.now() - startTime });
    }

    // 4. Embed all candidate articles
    const texts = toEmbed.map(item =>
      `${item.title}. ${item.contentSnippet || ''}`.trim()
    );

    let embeddings: number[][];
    try {
      embeddings = await embedTexts(texts);
      stats.embedded = embeddings.length;
    } catch (err) {
      stats.errors.push(`Embedding failed: ${err instanceof Error ? err.message : String(err)}`);
      return Response.json({ stats, durationMs: Date.now() - startTime }, { status: 500 });
    }

    // 5. For each article: semantic dedup → cluster → insert
    for (let i = 0; i < toEmbed.length; i++) {
      if (Date.now() - startTime > 240_000) break; // safety gate

      const item = toEmbed[i];
      const embedding = embeddings[i];

      try {
        // Semantic duplicate check
        const dup = await isDuplicate(item.link, embedding);
        if (dup) {
          stats.duplicates++;
          continue;
        }

        // Find or create cluster
        let clusterId = await findNearestCluster(embedding);
        if (clusterId) {
          stats.clustersUpdated++;
        } else {
          // Create new cluster
          const newCluster = await query<{ id: string }>(
            `INSERT INTO article_clusters (representative_title, status)
             VALUES ($1, 'pending')
             RETURNING id`,
            [item.title]
          );
          clusterId = newCluster[0].id;
          stats.clustersCreated++;
        }

        // Insert article
        const vectorLiteral = toVectorLiteral(embedding);
        await query(
          `INSERT INTO articles
             (source_key, source_name, url, title, snippet, image_url,
              category, region, pub_date, embedding, cluster_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector,$11)
           ON CONFLICT (url) DO NOTHING`,
          [
            item.source,
            item.sourceName,
            item.link,
            item.title,
            item.contentSnippet || null,
            item.imageUrl || null,
            item.category,
            item.region,
            item.pubDate,
            vectorLiteral,
            clusterId,
          ]
        );

        // Recalculate centroid with the new article included
        await updateClusterCentroid(clusterId);
        stats.inserted++;
      } catch (err) {
        stats.errors.push(
          `Article ${item.link}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 6. Expand global coverage for clusters that just crossed ≥2 articles (max 3/run)
    // No Gemini calls — pure Google News RSS discovery.
    try {
      const richClusters = await query<{ id: string; representative_title: string }>(
        `SELECT id, representative_title FROM article_clusters
         WHERE article_count >= 2 AND status = 'pending'
           AND pipeline_started_at IS NULL
         ORDER BY updated_at DESC LIMIT 3`
      );
      for (const cluster of richClusters) {
        if (Date.now() - startTime > 240_000) break;
        try {
          const report = await expandStory({ title: cluster.representative_title ?? '' });
          for (const item of report.items.slice(0, 8)) {
            if (!item.link) continue;
            await query(
              `INSERT INTO cluster_coverage (cluster_id, publisher, title, url, country, pub_date)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (url) DO NOTHING`,
              [
                cluster.id,
                item.sourceName,
                item.title,
                item.link,
                item.region,
                item.pubDate,
              ]
            );
            stats.coverageExpanded++;
          }
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }

    // 7. Purge articles and coverage older than 30 days (housekeeping)
    try {
      await query(`DELETE FROM cluster_coverage WHERE discovered_at < NOW() - INTERVAL '30 days'`);
      await query(`DELETE FROM articles WHERE ingested_at < NOW() - INTERVAL '30 days'`);
    } catch { /* non-fatal */ }

    return Response.json({
      stats,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stats,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
