import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { fetchNewsFeed, searchNews, NEWS_SOURCES, getAllSourceProfiles } from '@/lib/news';

export const maxDuration = 30;
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert analyst specializing in European Union and French news. You have access to live RSS feeds from five trusted free sources:

- France 24 🇫🇷 — French international broadcaster, strong on France and global politics
- RFI 📻 — Radio France Internationale, Francophone and African coverage
- Euronews 🇪🇺 — Pan-European broadcaster, EU institutions and policy
- Politico Europe 🇪🇺 — In-depth EU policy, Brussels, European Parliament analysis
- Deutsche Welle 🇩🇪 — German public broadcaster, Germany and European affairs

Your capabilities:
1. Fetch latest news from any or all sources
2. Search for specific topics or keywords across all feeds
3. Compare how different outlets cover the same story (cross-source profiling)
4. Identify trending topics across EU news landscape
5. Provide analytical context about EU politics, French affairs, and European integration

Always fetch live news before answering questions about current events. When analyzing coverage, note differences in emphasis between sources. Be concise but thorough — cite article titles and sources.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-opus-4-8'),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 5,
    tools: {
      fetchLatestNews: tool({
        description: 'Fetch the latest news articles from EU/French news sources. Use this to get current headlines and stories.',
        parameters: z.object({
          source: z.enum(['france24', 'rfi', 'euronews', 'politico', 'dw', 'all'])
            .optional()
            .default('all')
            .describe('Which source to fetch from. Use "all" for a comprehensive overview.'),
          limit: z.number().min(1).max(20).optional().default(8)
            .describe('Number of articles per source (1-20)'),
        }),
        execute: async ({ source, limit }) => {
          const sourceKey = source === 'all' ? undefined : source;
          const items = await fetchNewsFeed(sourceKey, limit);
          return {
            count: items.length,
            articles: items.map(item => ({
              title: item.title,
              source: item.sourceName,
              sourceFlag: item.sourceFlag,
              pubDate: item.pubDate,
              snippet: item.contentSnippet,
              categories: item.categories,
              link: item.link,
            })),
          };
        },
      }),

      searchNews: tool({
        description: 'Search for news articles matching specific keywords or topics across all sources.',
        parameters: z.object({
          query: z.string().describe('Search query — keywords, topic, person, or event to find'),
          source: z.enum(['france24', 'rfi', 'euronews', 'politico', 'dw', 'all'])
            .optional()
            .default('all')
            .describe('Limit search to a specific source or search all'),
        }),
        execute: async ({ query, source }) => {
          const sourceKey = source === 'all' ? undefined : source;
          const allItems = await fetchNewsFeed(sourceKey, 20);
          const results = searchNews(allItems, query);
          return {
            query,
            count: results.length,
            articles: results.map(item => ({
              title: item.title,
              source: item.sourceName,
              sourceFlag: item.sourceFlag,
              pubDate: item.pubDate,
              snippet: item.contentSnippet,
              categories: item.categories,
              link: item.link,
            })),
          };
        },
      }),

      profileSources: tool({
        description: 'Get detailed profiles of all available news sources — their coverage areas, editorial focus, and topics.',
        parameters: z.object({}),
        execute: async () => {
          return {
            sources: getAllSourceProfiles(),
            summary: `${Object.keys(NEWS_SOURCES).length} free EU/French news sources available with live RSS feeds.`,
          };
        },
      }),

      analyzeCoverage: tool({
        description: 'Fetch news from ALL sources simultaneously and analyze how different outlets cover topics — ideal for cross-source comparison and trend detection.',
        parameters: z.object({
          topic: z.string().optional().describe('Optional topic to focus the analysis on'),
          limit: z.number().min(1).max(15).optional().default(5)
            .describe('Articles per source'),
        }),
        execute: async ({ topic, limit }) => {
          const allItems = await fetchNewsFeed(undefined, limit);
          const filtered = topic ? searchNews(allItems, topic) : allItems;

          const bySource: Record<string, typeof filtered> = {};
          for (const item of filtered) {
            if (!bySource[item.sourceName]) bySource[item.sourceName] = [];
            bySource[item.sourceName].push(item);
          }

          const topicFrequency: Record<string, number> = {};
          for (const item of filtered) {
            for (const cat of item.categories || []) {
              topicFrequency[cat] = (topicFrequency[cat] || 0) + 1;
            }
          }

          const trendingTopics = Object.entries(topicFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([topic, count]) => ({ topic, count }));

          return {
            totalArticles: filtered.length,
            bySource: Object.entries(bySource).map(([source, articles]) => ({
              source,
              count: articles.length,
              headlines: articles.slice(0, 3).map(a => a.title),
            })),
            trendingTopics,
            analyzedAt: new Date().toISOString(),
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
