import { fetchGNews, searchFeedUrl, getEdition, EDITIONS, type Edition } from '@/lib/gnews';
import type { NewsItem } from '@/lib/news';

/* ── Wire Scout: deterministic global source discovery ─────────────
   No Gemini calls — pure RSS + string matching.
   Used by: Newsroom Wire Scout, ingest cluster expansion, chat tool. */

export interface CoverageReport {
  items: NewsItem[];
  countries: string[];
  publishers: string[];
  total: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'as', 'by', 'from', 'after', 'over', 'amid', 'into', 'is', 'are',
  'was', 'were', 'be', 'has', 'have', 'had', 'its', 'his', 'her', 'their',
  'this', 'that', 'new', 'says', 'say', 'said', 'will', 'would', 'could',
  'may', 'might', 'more', 'than', 'about', 'not', 'how', 'why', 'what',
  'when', 'who', 'amid', 'against', 'after',
]);

export function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 5);
}

// Simple Jaccard similarity on word-sets — fast, no dependencies
function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function dedup(items: NewsItem[], existing: NewsItem[]): NewsItem[] {
  const seenUrls = new Set(existing.map(i => i.link));
  const seenTitles = existing.map(i => i.title);
  return items.filter(item => {
    if (!item.link || seenUrls.has(item.link)) return false;
    if (seenTitles.some(t => jaccard(t, item.title) > 0.55)) return false;
    seenUrls.add(item.link);
    seenTitles.push(item.title);
    return true;
  });
}

/* Expand a story by querying Google News across key editions in parallel.
   Returns up to 20 items from non-curated publishers, deduplicated. */
export async function expandStory(
  story: { title: string; link?: string },
  userEditionKey = 'US:en'
): Promise<CoverageReport> {
  const kw = keywords(story.title);
  if (kw.length === 0) return { items: [], countries: [], publishers: [], total: 0 };

  const query = kw.slice(0, 3).join(' ');

  // Always sweep these four editions for coverage breadth
  const editionKeys = Array.from(new Set(['US:en', 'GB:en', 'IN:en', userEditionKey]));
  const editionObjs: Edition[] = editionKeys.map(getEdition);

  const batches = await Promise.allSettled(
    editionObjs.map(ed => fetchGNews(searchFeedUrl(query, ed), 8))
  );

  const existing: NewsItem[] = [{ ...story as NewsItem, title: story.title }];
  const all: NewsItem[] = [];

  for (let i = 0; i < batches.length; i++) {
    const result = batches[i];
    if (result.status === 'fulfilled') {
      const edition = editionObjs[i];
      const fresh = dedup(result.value, [...existing, ...all]);
      fresh.forEach(item => { item.region = edition.region; });
      all.push(...fresh);
    }
  }

  const countries = Array.from(new Set(
    editionKeys.filter((_, i) => batches[i].status === 'fulfilled').map(k => k.split(':')[0])
  ));
  const publishers = Array.from(new Set(all.map(i => i.sourceName).filter(Boolean)));

  return { items: all.slice(0, 20), countries, publishers, total: all.length };
}

/* Discover articles on any topic in any edition — used by chat and follows. */
export async function discoverTopic(
  topicQuery: string,
  editionKey = 'US:en',
  limit = 10
): Promise<NewsItem[]> {
  const edition = getEdition(editionKey);
  const url = searchFeedUrl(topicQuery, edition);
  return fetchGNews(url, limit);
}

/* Edition-aware top news — for the edition picker on the feed. */
export async function fetchEditionFeed(editionKey: string, limit = 15): Promise<NewsItem[]> {
  const edition = getEdition(editionKey);
  const items = await fetchGNews(topFeedUrl(edition), limit);
  items.forEach(item => { item.sourceFlag = edition.flag; });
  return items;
}

// re-export so newsroom.ts can import from one place
import { topFeedUrl } from '@/lib/gnews';
export { topFeedUrl, EDITIONS };
