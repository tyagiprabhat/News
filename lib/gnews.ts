import Parser from 'rss-parser';
import { cacheGet, cacheSet } from '@/lib/cache';
import { categorize, type NewsItem } from '@/lib/news';

/* ── Google News RSS — unlimited free global coverage ──────────────
   Format: news.google.com/rss/search?q={query}&hl={hl}&gl={gl}&ceid={gl}:{hl}
   Publishers appear in the <source> tag; titles carry " - Publisher" suffix.
   No API key, no quota. Cache every feed for 15 minutes.              */

export interface Edition {
  key: string;   // e.g. 'FR:fr'
  label: string;
  hl: string;    // language code for Google News
  gl: string;    // country code
  flag: string;
  region: string; // matches NewsItem.region values
}

export const EDITIONS: Edition[] = [
  { key: 'US:en', label: 'United States', hl: 'en', gl: 'US', flag: '🇺🇸', region: 'americas' },
  { key: 'GB:en', label: 'United Kingdom', hl: 'en', gl: 'GB', flag: '🇬🇧', region: 'europe' },
  { key: 'AU:en', label: 'Australia',      hl: 'en', gl: 'AU', flag: '🇦🇺', region: 'asia' },
  { key: 'CA:en', label: 'Canada',         hl: 'en', gl: 'CA', flag: '🇨🇦', region: 'americas' },
  { key: 'IN:en', label: 'India',          hl: 'en', gl: 'IN', flag: '🇮🇳', region: 'india' },
  { key: 'FR:fr', label: 'France',         hl: 'fr', gl: 'FR', flag: '🇫🇷', region: 'europe' },
  { key: 'DE:de', label: 'Germany',        hl: 'de', gl: 'DE', flag: '🇩🇪', region: 'europe' },
  { key: 'ES:es', label: 'Spain',          hl: 'es', gl: 'ES', flag: '🇪🇸', region: 'europe' },
  { key: 'BR:pt', label: 'Brazil',         hl: 'pt', gl: 'BR', flag: '🇧🇷', region: 'americas' },
  { key: 'JP:ja', label: 'Japan',          hl: 'ja', gl: 'JP', flag: '🇯🇵', region: 'asia' },
  { key: 'KR:ko', label: 'South Korea',    hl: 'ko', gl: 'KR', flag: '🇰🇷', region: 'asia' },
  { key: 'ZA:en', label: 'South Africa',   hl: 'en', gl: 'ZA', flag: '🇿🇦', region: 'mea' },
  { key: 'NG:en', label: 'Nigeria',        hl: 'en', gl: 'NG', flag: '🇳🇬', region: 'mea' },
  { key: 'AR:es', label: 'Argentina',      hl: 'es', gl: 'AR', flag: '🇦🇷', region: 'americas' },
];

// Google News topic feed tokens (mapped from our CATEGORIES keys)
const TOPIC_TOKENS: Record<string, string> = {
  world:         'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
  business:      'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6Y3lBU0FtVnVHZ0pWVXlnQVAB',
  tech:          'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB',
  entertainment: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB',
  sports:        'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB',
  science:       'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB',
  health:        'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
};

const GNEWS_CACHE_TTL = 15 * 60; // 15 minutes

const parser = new Parser({
  timeout: 8000,
  customFields: {
    item: [['source', 'gnSource']],
  },
});

function gnCacheKey(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) { h = (h << 5) - h + url.charCodeAt(i); h |= 0; }
  return `gn:${(h >>> 0).toString(36)}`;
}

function stripPublisher(title: string): string {
  // Google News titles end with " - Publisher Name"
  return title.replace(/\s-\s[^-]+$/, '').trim();
}

export function searchFeedUrl(query: string, edition: Edition, freshness = '24h'): string {
  const q = encodeURIComponent(`${query} when:${freshness}`);
  return `https://news.google.com/rss/search?q=${q}&hl=${edition.hl}&gl=${edition.gl}&ceid=${edition.gl}:${edition.hl}`;
}

export function topFeedUrl(edition: Edition): string {
  return `https://news.google.com/rss?hl=${edition.hl}&gl=${edition.gl}&ceid=${edition.gl}:${edition.hl}`;
}

export function topicFeedUrl(categoryKey: string, edition: Edition): string {
  const token = TOPIC_TOKENS[categoryKey];
  if (!token) return topFeedUrl(edition);
  return `https://news.google.com/rss/topics/${token}?hl=${edition.hl}&gl=${edition.gl}&ceid=${edition.gl}:${edition.hl}`;
}

export function getEdition(key: string): Edition {
  return EDITIONS.find(e => e.key === key) ?? EDITIONS[0];
}

export async function fetchGNews(url: string, limit = 10): Promise<NewsItem[]> {
  const cacheKey = gnCacheKey(url);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try { return (JSON.parse(cached) as NewsItem[]).slice(0, limit); } catch {}
  }

  try {
    const feed = await parser.parseURL(url);
    const items: NewsItem[] = (feed.items || []).slice(0, 20).map((item): NewsItem => {
      const rawTitle = item.title || 'Untitled';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gnSrc = (item as any).gnSource;
      const publisher: string = gnSrc
        ? String(typeof gnSrc === 'object' && gnSrc !== null ? (gnSrc._ ?? gnSrc) : gnSrc)
        : '';
      return {
        title: stripPublisher(rawTitle),
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        contentSnippet: item.contentSnippet?.slice(0, 300),
        categories: item.categories,
        imageUrl: undefined, // Google News RSS has no images
        category: categorize(rawTitle, item.contentSnippet, item.categories),
        region: 'global',
        source: 'gnews',
        sourceName: publisher || 'Google News',
        sourceFlag: '🌐',
      };
    });
    if (items.length > 0) {
      await cacheSet(cacheKey, JSON.stringify(items), GNEWS_CACHE_TTL);
    }
    return items.slice(0, limit);
  } catch {
    return [];
  }
}
