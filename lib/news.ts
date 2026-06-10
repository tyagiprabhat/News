import Parser from 'rss-parser';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  imageUrl?: string;
  category: string;
  region: string;
  source: string;
  sourceName: string;
  sourceFlag: string;
}

export interface SourceConfig {
  name: string;
  url: string;
  flag: string;
  region: string;
  // Relative share of the merged feed, based on global reach/popularity.
  // The feed composition is proportional to these weights.
  weight: number;
  topics: string[];
}

export const REGIONS = [
  { key: 'all',      label: 'Worldwide',       emoji: '🌐' },
  { key: 'global',   label: 'Global Wires',    emoji: '📰' },
  { key: 'americas', label: 'Americas',        emoji: '🌎' },
  { key: 'europe',   label: 'Europe',          emoji: '🇪🇺' },
  { key: 'mea',      label: 'Middle East & Africa', emoji: '🌍' },
  { key: 'asia',     label: 'Asia-Pacific',    emoji: '🌏' },
  { key: 'india',    label: 'India',           emoji: '🇮🇳' },
] as const;

export const NEWS_SOURCES: Record<string, SourceConfig> = {
  // ── Global wires & broadcasters ──────────────────────────────
  ap: {
    name: 'AP News',
    url: 'https://feeds.apnews.com/rss/apf-topnews',
    flag: '📰',
    region: 'global',
    weight: 10,
    topics: ['Breaking News', 'World', 'US', 'Politics', 'Business'],
  },
  bbc: {
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    flag: '🇬🇧',
    region: 'global',
    weight: 9,
    topics: ['World', 'UK', 'Politics', 'Science', 'Technology'],
  },
  guardian: {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    flag: '🗞️',
    region: 'global',
    weight: 7,
    topics: ['World', 'UK', 'Politics', 'Environment', 'Social Affairs'],
  },
  economist: {
    name: 'The Economist',
    url: 'https://www.economist.com/rss/the_world_this_week_rss.xml',
    flag: '📊',
    region: 'global',
    weight: 4,
    topics: ['Economics', 'Finance', 'Politics', 'Business', 'Global Affairs'],
  },

  // ── Americas ─────────────────────────────────────────────────
  nyt: {
    name: 'The New York Times',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    flag: '🗽',
    region: 'americas',
    weight: 8,
    topics: ['US', 'World', 'Politics', 'Business', 'Investigations'],
  },
  wapo: {
    name: 'The Washington Post',
    url: 'https://feeds.washingtonpost.com/rss/world',
    flag: '📰',
    region: 'americas',
    weight: 7,
    topics: ['US', 'World', 'Politics', 'National Security', 'Investigations'],
  },
  npr: {
    name: 'NPR',
    url: 'https://feeds.npr.org/1001/rss.xml',
    flag: '🎙️',
    region: 'americas',
    weight: 6,
    topics: ['US', 'World', 'Politics', 'Culture', 'Science'],
  },
  pbs: {
    name: 'PBS NewsHour',
    url: 'https://www.pbs.org/newshour/feeds/rss/headlines',
    flag: '📺',
    region: 'americas',
    weight: 4,
    topics: ['US', 'World', 'Politics', 'Analysis', 'Science'],
  },
  propublica: {
    name: 'ProPublica',
    url: 'https://www.propublica.org/feeds/propublica/main',
    flag: '🔍',
    region: 'americas',
    weight: 4,
    topics: ['Investigations', 'Accountability', 'Politics', 'Justice', 'Health'],
  },
  mercopress: {
    name: 'MercoPress',
    url: 'https://en.mercopress.com/rss/',
    flag: '🌎',
    region: 'americas',
    weight: 3,
    topics: ['Latin America', 'South Atlantic', 'Trade', 'Politics'],
  },

  // ── Europe ───────────────────────────────────────────────────
  france24: {
    name: 'France 24',
    url: 'https://www.france24.com/en/rss',
    flag: '🇫🇷',
    region: 'europe',
    weight: 5,
    topics: ['France', 'EU', 'International', 'Politics', 'Economy'],
  },
  euronews: {
    name: 'Euronews',
    url: 'https://feeds.feedburner.com/euronews/en/home/',
    flag: '🇪🇺',
    region: 'europe',
    weight: 5,
    topics: ['EU', 'Europe', 'Politics', 'Economy', 'Tech'],
  },
  dw: {
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    flag: '🇩🇪',
    region: 'europe',
    weight: 5,
    topics: ['Germany', 'EU', 'International', 'Economy', 'Science'],
  },
  politico: {
    name: 'Politico Europe',
    url: 'https://www.politico.eu/feed/',
    flag: '🏛️',
    region: 'europe',
    weight: 4,
    topics: ['EU Policy', 'Brussels', 'European Parliament', 'Politics'],
  },
  rfi: {
    name: 'RFI',
    url: 'https://www.rfi.fr/en/rss',
    flag: '📻',
    region: 'europe',
    weight: 3,
    topics: ['France', 'Francophone', 'Africa', 'International'],
  },

  // ── Middle East & Africa ─────────────────────────────────────
  aljazeera: {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    flag: '🌍',
    region: 'mea',
    weight: 7,
    topics: ['Middle East', 'World', 'Politics', 'Conflicts', 'Human Rights'],
  },
  allafrica: {
    name: 'AllAfrica',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    flag: '🌍',
    region: 'mea',
    weight: 4,
    topics: ['Africa', 'Politics', 'Development', 'Business'],
  },

  // ── Asia-Pacific ─────────────────────────────────────────────
  cna: {
    name: 'CNA',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
    flag: '🇸🇬',
    region: 'asia',
    weight: 6,
    topics: ['Asia', 'Singapore', 'Business', 'World', 'Politics'],
  },
  scmp: {
    name: 'South China Morning Post',
    url: 'https://www.scmp.com/rss/91/feed',
    flag: '🇭🇰',
    region: 'asia',
    weight: 5,
    topics: ['China', 'Hong Kong', 'Asia', 'Business', 'Tech'],
  },
  chinadaily: {
    name: 'China Daily',
    url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',
    flag: '🇨🇳',
    region: 'asia',
    weight: 4,
    topics: ['China', 'World', 'Business', 'Politics', 'Asia'],
  },
  japantimes: {
    name: 'The Japan Times',
    url: 'https://www.japantimes.co.jp/feed/',
    flag: '🇯🇵',
    region: 'asia',
    weight: 4,
    topics: ['Japan', 'Asia', 'Business', 'Culture', 'World'],
  },
  abcau: {
    name: 'ABC News Australia',
    url: 'https://www.abc.net.au/news/feed/51120/rss.xml',
    flag: '🇦🇺',
    region: 'asia',
    weight: 4,
    topics: ['Australia', 'Pacific', 'World', 'Politics', 'Science'],
  },

  // ── India ────────────────────────────────────────────────────
  hindu: {
    name: 'The Hindu',
    url: 'https://www.thehindu.com/feeder/default.rss',
    flag: '🇮🇳',
    region: 'india',
    weight: 4,
    topics: ['India', 'Politics', 'Economy', 'Science', 'International'],
  },
  indianexpress: {
    name: 'Indian Express',
    url: 'https://indianexpress.com/feed/',
    flag: '🇮🇳',
    region: 'india',
    weight: 4,
    topics: ['India', 'Politics', 'Investigations', 'Explainers', 'Opinion'],
  },
  toi: {
    name: 'Times of India',
    url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    flag: '🇮🇳',
    region: 'india',
    weight: 3,
    topics: ['India', 'Business', 'Sports', 'Entertainment', 'World'],
  },
};

interface MediaField {
  $?: { url?: string };
}

type RawItem = Parser.Item & {
  mediaContent?: MediaField[];
  mediaThumbnail?: MediaField | MediaField[];
  contentEncoded?: string;
};

const parser: Parser<Record<string, unknown>, RawItem> = new Parser({
  headers: { 'User-Agent': 'Breve/1.0 (RSS Reader)' },
  timeout: 8000,
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

export const CATEGORIES = [
  { key: 'all',           label: 'My Feed',       emoji: '🔥' },
  { key: 'world',         label: 'World',         emoji: '🌍' },
  { key: 'politics',      label: 'Politics',      emoji: '🏛️' },
  { key: 'conflict',      label: 'War & Conflict', emoji: '⚔️' },
  { key: 'business',      label: 'Business',      emoji: '💼' },
  { key: 'sports',        label: 'Sports',        emoji: '⚽' },
  { key: 'tech',          label: 'Tech',          emoji: '💻' },
  { key: 'science',       label: 'Science',       emoji: '🔬' },
  { key: 'health',        label: 'Health',        emoji: '🩺' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { key: 'climate',       label: 'Climate',       emoji: '🌱' },
] as const;

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  conflict:      /\b(war|ukraine|gaza|israel|hamas|strike[sd]?|missile|attack|military|troops|ceasefire|invasion|airstrike|drone|conflict|hostage|bombing|nato)\b/i,
  sports:        /\b(football|soccer|cricket|tennis|olympic|fifa|world cup|premier league|ipl|nba|nfl|formula 1|f1|grand prix|champions league|athlete|tournament|medal|wimbledon)\b/i,
  business:      /\b(econom(y|ic)|market[s]?|stock[s]?|inflation|gdp|trade|tariff[s]?|earnings|profit|ipo|merger|startup|bank(ing)?|interest rate[s]?|investor|billion|recession|currency)\b/i,
  tech:          /\b(tech(nology)?|ai|artificial intelligence|software|app|google|apple|microsoft|meta|amazon|cyber|chip[s]?|semiconductor|smartphone|robot|crypto|bitcoin|data breach)\b/i,
  science:       /\b(science|research(ers)?|space|nasa|spacex|rocket|satellite|telescope|quantum|physics|archaeolog|fossil|dna|astronom)\b/i,
  health:        /\b(health|covid|vaccine|virus|disease|cancer|hospital|doctor[s]?|outbreak|epidemic|pandemic|mental health|drug|fda|who\b)\b/i,
  entertainment: /\b(film|movie|bollywood|hollywood|actor|actress|celebrity|music|singer|concert|netflix|oscar[s]?|grammy|festival|tv series|box office)\b/i,
  climate:       /\b(climate|warming|emission[s]?|carbon|renewable|solar|wind energy|wildfire[s]?|flood(s|ing)?|drought|heatwave|cop\d{2}|environment(al)?)\b/i,
  politics:      /\b(election[s]?|parliament|president|minister|congress|senate|vote[rs]?|policy|government|coalition|campaign|legislation|referendum|democrat|republican|brexit|eu summit)\b/i,
};

export function categorize(title: string, snippet?: string, categories?: string[]): string {
  const text = `${title} ${snippet ?? ''} ${(categories ?? []).join(' ')}`;
  for (const [key, re] of Object.entries(CATEGORY_KEYWORDS)) {
    if (re.test(text)) return key;
  }
  return 'world';
}

function extractImage(item: RawItem): string | undefined {
  if (item.enclosure?.url && /image|jpe?g|png|webp/i.test(`${item.enclosure.type ?? ''} ${item.enclosure.url}`)) {
    return item.enclosure.url;
  }
  const media = item.mediaContent?.find(m => m.$?.url);
  if (media?.$?.url) return media.$.url;
  const thumb = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail;
  if (thumb?.$?.url) return thumb.$.url;
  const html = item.contentEncoded || item.content || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

// 5-minute in-memory cache — prevents hammering the RSS feeds on every request
const RSS_CACHE = new Map<string, { items: NewsItem[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60_000;
const MAX_PER_SOURCE = 15;

async function fetchSource(key: string, source: SourceConfig, limit: number): Promise<NewsItem[]> {
  const cached = RSS_CACHE.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.items.slice(0, limit);
  }

  const feed = await parser.parseURL(source.url);
  const items = (feed.items || []).slice(0, MAX_PER_SOURCE).map((item): NewsItem => ({
    title: item.title || 'Untitled',
    link: item.link || '',
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    contentSnippet: item.contentSnippet?.slice(0, 300),
    content: item.content?.slice(0, 1000),
    categories: item.categories,
    imageUrl: extractImage(item),
    category: categorize(item.title || '', item.contentSnippet, item.categories),
    region: source.region,
    source: key,
    sourceName: source.name,
    sourceFlag: source.flag,
  }));

  RSS_CACHE.set(key, { items, expiresAt: Date.now() + CACHE_TTL });
  return items.slice(0, limit);
}

export async function fetchNewsFeed(sourceKey?: string, limit = 10): Promise<NewsItem[]> {
  if (sourceKey && NEWS_SOURCES[sourceKey]) {
    try {
      return await fetchSource(sourceKey, NEWS_SOURCES[sourceKey], limit);
    } catch {
      return [];
    }
  }

  // Each source's share of the merged feed is proportional to its global
  // popularity weight (clamped so even small outlets always surface).
  const entries = Object.entries(NEWS_SOURCES);
  const meanWeight = entries.reduce((s, [, src]) => s + src.weight, 0) / entries.length;

  const results = await Promise.allSettled(
    entries.map(([key, source]) => {
      const quota = Math.min(Math.max(Math.round(limit * source.weight / meanWeight), 2), MAX_PER_SOURCE);
      return fetchSource(key, source, quota);
    })
  );

  // Round-robin interleave: newest from each source in turn, so no single
  // high-frequency feed dominates the top. Weighted quotas mean popular
  // sources stay represented in deeper rounds.
  const perSource: NewsItem[][] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      perSource.push(
        [...result.value].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      );
    }
  }
  // Sources with the freshest top story go first within each round
  perSource.sort((a, b) => new Date(b[0].pubDate).getTime() - new Date(a[0].pubDate).getTime());

  const items: NewsItem[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const sourceItems of perSource) {
      if (round < sourceItems.length) {
        items.push(sourceItems[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  return items;
}

export function searchNews(items: NewsItem[], query: string): NewsItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const text = `${item.title} ${item.contentSnippet || ''} ${(item.categories || []).join(' ')}`.toLowerCase();
    return terms.every(term => text.includes(term));
  });
}

const SOURCE_TYPES: Record<string, string> = {
  ap: 'Wire Service',
  bbc: 'Public Broadcaster',
  guardian: 'National Newspaper',
  economist: 'Magazine/Analysis',
  nyt: 'National Newspaper',
  wapo: 'National Newspaper',
  npr: 'Public Radio',
  pbs: 'Public Broadcaster',
  propublica: 'Investigative Nonprofit',
  mercopress: 'Regional News Agency',
  france24: 'International Broadcaster',
  euronews: 'Pan-European Broadcaster',
  dw: 'Public Broadcaster',
  politico: 'Policy/Analysis',
  rfi: 'International Radio',
  aljazeera: 'International Broadcaster',
  allafrica: 'News Aggregator',
  cna: 'International Broadcaster',
  scmp: 'National Newspaper',
  chinadaily: 'State Newspaper',
  japantimes: 'National Newspaper',
  abcau: 'Public Broadcaster',
  hindu: 'National Newspaper',
  indianexpress: 'National Newspaper',
  toi: 'National Newspaper',
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
