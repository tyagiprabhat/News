import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import { fetchNewsFeed, searchNews, NEWS_SOURCES, getAllSourceProfiles } from '@/lib/news';

export const maxDuration = 30;
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert analyst and multilingual translator specializing in global news with a deep focus on European Union and French affairs. You have access to live RSS feeds from ten trusted free sources:

Wire services:
- AP News 📰 — Associated Press global wire service, authoritative breaking news
- Reuters 📡 — Reuters global wire, finance and world news

Anglophone broadcasters:
- BBC News 🇬🇧 — British public broadcaster, strong world and UK coverage
- NPR 🎙️ — US public radio, US politics and international affairs
- Al Jazeera 🌍 — Qatar-based international broadcaster, Middle East and global South

EU/European sources:
- France 24 🇫🇷 — French international broadcaster, France and global politics
- RFI 📻 — Radio France Internationale, Francophone and African coverage
- Euronews 🇪🇺 — Pan-European broadcaster, EU institutions and policy
- Politico Europe 🇪🇺 — In-depth EU policy, Brussels, European Parliament analysis
- Deutsche Welle 🇩🇪 — German public broadcaster, Germany and European affairs

Your capabilities:
1. Fetch and analyze live news from any or all sources
2. Search for specific topics, people, or events across all feeds
3. Cross-source profiling — compare how wire services vs. broadcasters cover the same story
4. Trend detection — identify what topics are dominating across the news landscape
5. Translation — translate any text or article snippet between languages (French, German, Spanish, Arabic, English, and more)
6. Editorial analysis — explain how a story's framing differs between AP/Reuters wire copy and editorial outlets

Always fetch live news before answering questions about current events. When comparing sources, note wire services (AP, Reuters) as the baseline — they supply raw facts that outlets then editorialize. Be concise but thorough — cite article titles and sources.`;

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
          source: z.enum(['ap', 'reuters', 'bbc', 'npr', 'aljazeera', 'france24', 'rfi', 'euronews', 'politico', 'dw', 'all'])
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
          source: z.enum(['ap', 'reuters', 'bbc', 'npr', 'aljazeera', 'france24', 'rfi', 'euronews', 'politico', 'dw', 'all'])
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

      translateText: tool({
        description: 'Translate any text into a target language. Use this when the user asks to translate an article, headline, or any content.',
        parameters: z.object({
          text: z.string().describe('The text to translate'),
          targetLanguage: z.string().describe('Target language name or code, e.g. "French", "German", "Arabic", "Spanish", "English"'),
          sourceLanguage: z.string().optional().describe('Source language if known — leave blank for auto-detect'),
        }),
        execute: async ({ text, targetLanguage, sourceLanguage }) => {
          const from = sourceLanguage ? `from ${sourceLanguage} ` : '';
          const { text: translated } = await generateText({
            model: anthropic('claude-opus-4-8'),
            messages: [
              {
                role: 'user',
                content: `Translate the following text ${from}into ${targetLanguage}. Return only the translated text, no explanations or notes.\n\n${text}`,
              },
            ],
          });
          return {
            original: text,
            translated,
            targetLanguage,
            sourceLanguage: sourceLanguage || 'auto-detected',
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
