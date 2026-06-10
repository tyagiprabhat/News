import { google } from '@ai-sdk/google';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import { fetchNewsFeed, searchNews, NEWS_SOURCES, getAllSourceProfiles } from '@/lib/news';
import { buildTranslatePrompt } from '@/lib/translate';
import { buildSummarizePrompt } from '@/lib/summarize';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const maxDuration = 60;
export const runtime = 'nodejs';

// Google Gemini 2.5 Flash — set GOOGLE_GENERATIVE_AI_API_KEY in Vercel env vars
// Free tier: 1,500 RPD, 15 RPM, 1M TPM — no credit card required
// aistudio.google.com → Get API key → free forever
const CHAT_MODEL = google('gemini-2.5-flash');
const FAST_MODEL = google('gemini-2.5-flash');

const SOURCE_ENUM = ['ap', 'guardian', 'bbc', 'npr', 'aljazeera', 'france24', 'rfi', 'euronews', 'politico', 'dw', 'hindu', 'toi', 'economist'] as const;

const SYSTEM_PROMPT = `You are an expert analyst, multilingual translator, and news briefing agent covering global affairs with a deep focus on Europe, India, and international politics. You have access to live RSS feeds from 13 trusted free sources:

Wire services: AP News 📰
Global broadcasters: BBC 🇬🇧, NPR 🎙️, Al Jazeera 🌍, The Guardian 🗞️
European sources: France 24 🇫🇷, RFI 📻, Euronews 🇪🇺, Politico Europe 🇪🇺, Deutsche Welle 🇩🇪
Indian sources: The Hindu 🇮🇳, Times of India 🇮🇳
Analysis: The Economist 📊

Your capabilities:
1. Fetch and analyze live news from any or all sources
2. Search for specific topics, people, or events across all feeds
3. Cross-source profiling — compare wire services vs. editorial outlets on the same story
4. Trend detection — identify what topics dominate the news landscape
5. Translation — translate any text between languages (French, German, Spanish, Arabic, Hindi, English, and more)
6. Editorial analysis — explain how framing differs between wire copy and editorial outlets
7. Briefings — generate a structured news digest with AI-written 60-word summaries per story, optionally in any language

Always fetch live news before answering questions about current events. When producing briefings, use the generateBriefing tool. Be concise but thorough — cite article titles and sources.`;

export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 10);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { messages } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 6,
    tools: {
      fetchLatestNews: tool({
        description: 'Fetch the latest news articles from any of the 13 sources.',
        parameters: z.object({
          source: z.enum([...SOURCE_ENUM, 'all']).optional().default('all')
            .describe('Which source to fetch from. Use "all" for a broad overview.'),
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
          source: z.enum([...SOURCE_ENUM, 'all']).optional().default('all')
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
        description: 'Get detailed profiles of all 13 available news sources.',
        parameters: z.object({}),
        execute: async () => ({
          sources: getAllSourceProfiles(),
          total: Object.keys(NEWS_SOURCES).length,
        }),
      }),

      analyzeCoverage: tool({
        description: 'Fetch from ALL sources and analyze cross-outlet coverage — best for trend detection and editorial comparison.',
        parameters: z.object({
          topic: z.string().optional().describe('Optional topic to focus the analysis on'),
          limit: z.number().min(1).max(15).optional().default(5).describe('Articles per source'),
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

          return {
            totalArticles: filtered.length,
            bySource: Object.entries(bySource).map(([source, articles]) => ({
              source,
              count: articles.length,
              headlines: articles.slice(0, 3).map(a => a.title),
            })),
            trendingTopics: Object.entries(topicFrequency)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([topic, count]) => ({ topic, count })),
            analyzedAt: new Date().toISOString(),
          };
        },
      }),

      translateText: tool({
        description: 'Translate any text into a target language.',
        parameters: z.object({
          text: z.string().describe('The text to translate'),
          targetLanguage: z.string().describe('Target language, e.g. "French", "German", "Arabic", "Hindi"'),
          sourceLanguage: z.string().optional().describe('Source language — omit for auto-detect'),
        }),
        execute: async ({ text, targetLanguage, sourceLanguage }) => {
          const { text: translated } = await generateText({
            model: FAST_MODEL,
            messages: [{ role: 'user', content: buildTranslatePrompt(text, targetLanguage, sourceLanguage) }],
          });
          return {
            original: text,
            translated,
            targetLanguage,
            sourceLanguage: sourceLanguage ?? 'auto-detected',
          };
        },
      }),

      generateBriefing: tool({
        description: 'Generate a structured news digest: fetches top stories, writes a punchy 60-word AI summary for each, and returns the full briefing. Use when asked for a briefing, digest, roundup, or morning summary. Optionally produce summaries in a non-English language.',
        parameters: z.object({
          topic: z.string().optional()
            .describe('Focus topic, e.g. "EU politics", "India economy", "climate"'),
          language: z.string().optional().default('English')
            .describe('Language for the summaries, e.g. "French", "Arabic", "Hindi"'),
          sources: z.array(z.enum(SOURCE_ENUM)).optional()
            .describe('Limit to specific sources. Omit for all sources.'),
          count: z.number().min(3).max(8).optional().default(5)
            .describe('Number of stories to include (3-8)'),
        }),
        execute: async ({ topic, language, sources, count }) => {
          let articles = await fetchNewsFeed(undefined, 12);

          if (sources && sources.length > 0) {
            articles = articles.filter(a => sources.includes(a.source as typeof SOURCE_ENUM[number]));
          }
          if (topic) articles = searchNews(articles, topic);
          articles = articles.slice(0, count ?? 5);

          const targetLang = language && language.toLowerCase() !== 'english' ? language : undefined;

          const results = await Promise.allSettled(
            articles.map(async article => {
              const { text } = await generateText({
                model: FAST_MODEL,
                messages: [{
                  role: 'user',
                  content: buildSummarizePrompt(article.title, article.contentSnippet, article.sourceName, targetLang),
                }],
              });
              return {
                title: article.title,
                source: article.sourceName,
                sourceFlag: article.sourceFlag,
                pubDate: article.pubDate,
                link: article.link,
                summary: text.trim(),
              };
            })
          );

          const stories = results
            .filter((r): r is PromiseFulfilledResult<{
              title: string; source: string; sourceFlag: string;
              pubDate: string; link: string; summary: string;
            }> => r.status === 'fulfilled')
            .map(r => r.value);

          return {
            generatedAt: new Date().toISOString(),
            briefingTopic: topic ?? 'Top Stories',
            language: language ?? 'English',
            storyCount: stories.length,
            stories,
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
