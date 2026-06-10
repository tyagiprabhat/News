import { embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import { query } from '@/lib/db';

const EMBEDDING_MODEL = google.textEmbeddingModel('text-embedding-004');
const DEDUP_THRESHOLD = 0.88;
const CLUSTER_THRESHOLD = 0.82;
const BATCH_SIZE = 20;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings: batchEmbeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: batch,
    });
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function isDuplicate(url: string, embedding: number[]): Promise<boolean> {
  // URL check first (fast path)
  const urlRows = await query<{ id: string }>(
    'SELECT id FROM articles WHERE url = $1 LIMIT 1',
    [url]
  );
  if (urlRows.length > 0) return true;

  // Semantic similarity check within last 6 hours
  const literal = toVectorLiteral(embedding);
  const rows = await query<{ similarity: number }>(
    `SELECT 1 - (embedding <=> $1::vector) AS similarity
     FROM articles
     WHERE ingested_at > NOW() - INTERVAL '6 hours'
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [literal]
  );
  if (rows.length > 0 && rows[0].similarity >= DEDUP_THRESHOLD) return true;

  return false;
}

export async function findNearestCluster(embedding: number[]): Promise<string | null> {
  const literal = toVectorLiteral(embedding);
  const rows = await query<{ id: string; similarity: number }>(
    `SELECT id, 1 - (centroid <=> $1::vector) AS similarity
     FROM article_clusters
     WHERE created_at > NOW() - INTERVAL '24 hours'
       AND centroid IS NOT NULL
       AND status IN ('pending', 'processing', 'done')
     ORDER BY centroid <=> $1::vector
     LIMIT 1`,
    [literal]
  );
  if (rows.length > 0 && rows[0].similarity >= CLUSTER_THRESHOLD) {
    return rows[0].id;
  }
  return null;
}

export async function updateClusterCentroid(clusterId: string): Promise<void> {
  // Recalculate centroid as average of all article embeddings in cluster
  await query(
    `UPDATE article_clusters
     SET centroid = (
       SELECT AVG(embedding)
       FROM articles
       WHERE cluster_id = $1 AND embedding IS NOT NULL
     ),
     article_count = (
       SELECT COUNT(*) FROM articles WHERE cluster_id = $1
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [clusterId]
  );
}
