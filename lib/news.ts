import Parser from 'rss-parser';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  source: string;
  sourceName: string;
  sourceFlag: string;
}

export const NEWS_SOURCES: Record<string, { name: string; url: string; flag: string; topics: string[] }> = {
  ap: {
    name: 'AP News',
    url: 'https://feeds.apnews.com/rss/apf-topnews',
    flag: '📰',
    topics: ['Breaking News', 'World', 'US', 'Politics', 'Business'],
  },
  guardian: {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    flag: '🗞️',
    topics: ['World', 'UK', 'Politics', 'Environment', 'Social Affairs'],
  },
  bbc: {
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    flag: '🇬🇧',
    topics: ['World', 'UK', 'Politics', 'Science', 'Technology'],
  },
  npr: {
    name: 'NPR',
    url: 'https://feeds.npr.org/1001/rss.xml',
    flag: '🎙️',
    topics: ['US', 'World', 'Politics', 'Culture', 'Science'],
  },
  aljazeera: {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    flag: '🌍',
    topics: ['Middle East', 'World', 'Politics', 'Conflicts', 'Human Rights'],
  },
  france24: {
    name: 'France 24',
    url: 'https://www.france24.com/en/rss',
    flag: '🇫🇷',
    topics: ['France', 'EU', 'International', 'Politics', 'Economy'],
  },
  rfi: {
    name: 'RFI',
    url: 'https://www.rfi.fr/en/rss',
    flag: '📻',
    topics: ['France', 'Francophone', 'Africa', 'International'],
  },
  euronews: {
    name: 'Euronews',
    url: 'https://feeds.feedburner.com/euronews/en/home/',
    flag: '🇪🇺',
    topics: ['EU', 'Europe', 'Politics', 'Economy', 'Tech'],
  },
  politico: {
    name: 'Politico Europe',
    url: 'https://www.politico.eu/feed/',
    flag: '🇪🇺',
    topics: ['EU Policy', 'Brussels', 'European Parliament', 'Politics'],
  },
  dw: {
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    flag: '🇩🇪',
    topics: ['Germany', 'EU', 'International', 'Economy', 'Science'],
  },
  hindu: {
    name: 'The Hindu',
    url: 'https://www.thehindu.com/feeder/default.rss',
    flag: '🇮🇳',
    topics: ['India', 'Politics', 'Economy', 'Science', 'International'],
  },
  toi: {
    name: 'Times of India',
    url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    flag: '🇮🇳',
    topics: ['India', 'Business', 'Sports', 'Entertainment', 'World'],
  },
  economist: {
    name: 'The Economist',
    url: 'https://www.economist.com/rss/the_world_this_week_rss.xml',
    flag: '📊',
    topics: ['Economics', 'Finance', 'Politics', 'Business', 'Global Affairs'],
  },
};

const parser = new Parser({
  headers: { 'User-Agent': 'NewsAI/1.0 (RSS Reader)' },
  timeout: 8000,
});

// 5-minute in-memory cache — prevents hammering 13 RSS feeds on every request
const RSS_CACHE = new Map<string, { items: NewsItem[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60_000;

async function fetchSource(key: string, source: typeof NEWS_SOURCES[string], limit: number): Promise<NewsItem[]> {
  const cached = RSS_CACHE.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.items.slice(0, limit);
  }

  const feed = await parser.parseURL(source.url);
  const items = (feed.items || []).slice(0, Math.max(limit, 15)).map((item): NewsItem => ({
    title: item.title || 'Untitled',
    link: item.link || '',
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    contentSnippet: item.contentSnippet?.slice(0, 300),
    content: item.content?.slice(0, 1000),
    categories: item.categories,
    source: key,
    sourceName: source.name,
    sourceFlag: source.flag,
  }));

  RSS_CACHE.set(key, { items, expiresAt: Date.now() + CACHE_TTL });
  return items.slice(0, limit);
}

export async function fetchNewsFeed(sourceKey?: string, limit = 10): Promise<NewsItem[]> {
  const sources = sourceKey && NEWS_SOURCES[sourceKey]
    ? { [sourceKey]: NEWS_SOURCES[sourceKey] }
    : NEWS_SOURCES;

  const results = await Promise.allSettled(
    Object.entries(sources).map(([key, source]) => fetchSource(key, source, limit))
  );

  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') items.push(...result.value);
  }

  return items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

export function searchNews(items: NewsItem[], query: string): NewsItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const text = `${item.title} ${item.contentSnippet || ''} ${(item.categories || []).join(' ')}`.toLowerCase();
    return terms.every(term => text.includes(term));
  });
}

const SOURCE_TYPES: Record<string, string> = {
  politico: 'Policy/Analysis',
  ap: 'Wire Service',
  guardian: 'National Newspaper',
  bbc: 'Public Broadcaster',
  npr: 'Public Radio',
  aljazeera: 'International Broadcaster',
  france24: 'International Broadcaster',
  rfi: 'International Radio',
  euronews: 'Pan-European Broadcaster',
  dw: 'Public Broadcaster',
  hindu: 'National Newspaper',
  toi: 'National Newspaper',
  economist: 'Magazine/Analysis',
};

export function profileSource(sourceKey: string) {
  const source = NEWS_SOURCES[sourceKey];
  if (!source) return null;
  return {
    key: sourceKey,
    ...source,
    profile: {
      type: SOURCE_TYPES[sourceKey] || 'News Outlet',
      language: 'English',
      coverage: source.topics,
      free: true,
      rssAvailable: true,
    },
  };
}

export function getAllSourceProfiles() {
  return Object.entries(NEWS_SOURCES).map(([key]) => profileSource(key));
}
