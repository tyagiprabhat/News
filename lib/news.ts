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
};

const parser = new Parser({
  headers: { 'User-Agent': 'NewsAI/1.0 (RSS Reader)' },
  timeout: 10000,
});

export async function fetchNewsFeed(sourceKey?: string, limit = 10): Promise<NewsItem[]> {
  const sources = sourceKey && NEWS_SOURCES[sourceKey]
    ? { [sourceKey]: NEWS_SOURCES[sourceKey] }
    : NEWS_SOURCES;

  const results = await Promise.allSettled(
    Object.entries(sources).map(async ([key, source]) => {
      const feed = await parser.parseURL(source.url);
      return (feed.items || []).slice(0, limit).map((item): NewsItem => ({
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
    })
  );

  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
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

export function profileSource(sourceKey: string) {
  const source = NEWS_SOURCES[sourceKey];
  if (!source) return null;
  return {
    key: sourceKey,
    ...source,
    profile: {
      type: sourceKey === 'politico' ? 'Policy/Analysis' : 'Broadcast/General',
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
