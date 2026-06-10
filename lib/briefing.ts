import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { fetchNewsFeed, type NewsItem } from '@/lib/news';
import { fetchGNews, topFeedUrl, getEdition } from '@/lib/gnews';
import { cacheGet, cacheSet } from '@/lib/cache';
import { tryConsume } from '@/lib/ai-budget';

/* ── Daily briefing builder ─────────────────────────────────────────
   ONE flash call writes all summaries for an edition+language pair,
   cached for 24h — so each edition costs exactly one Gemini call per
   day no matter how many users open the morning brief.             */

export interface BriefStory {
  title: string;
  summary: string;
  source: string;
  link: string;
  pubDate: string;
  imageUrl?: string;
  category: string;
}

export interface Briefing {
  date: string;          // YYYY-MM-DD UTC
  edition: string;
  language: string;
  stories: BriefStory[];
  mode: 'ai' | 'fallback';
}

const BRIEF_TTL = 24 * 60 * 60;

function truncate(text: string | undefined, words: number): string {
  if (!text) return '';
  const parts = text.trim().split(/\s+/);
  return parts.length <= words ? text : parts.slice(0, words).join(' ') + '…';
}

export async function buildBriefing(
  editionKey = 'US:en',
  language = 'English',
  count = 5
): Promise<Briefing> {
  const date = new Date().toISOString().slice(0, 10);
  const cacheKey = `brief:v1:${editionKey}:${language.toLowerCase()}:${date}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    try { return JSON.parse(cached) as Briefing; } catch {}
  }

  // Source articles: curated backbone for default edition, Google News otherwise
  let articles: NewsItem[];
  if (editionKey === 'US:en') {
    articles = await fetchNewsFeed(undefined, count + 3);
  } else {
    articles = await fetchGNews(topFeedUrl(getEdition(editionKey)), count + 3);
  }
  articles = articles.filter(a => a.title && a.link).slice(0, count);

  const fallback: Briefing = {
    date,
    edition: editionKey,
    language,
    mode: 'fallback',
    stories: articles.map(a => ({
      title: a.title,
      summary: truncate(a.contentSnippet, 60) || a.title,
      source: a.sourceName,
      link: a.link,
      pubDate: a.pubDate,
      imageUrl: a.imageUrl,
      category: a.category,
    })),
  };

  if (articles.length === 0) return fallback;
  if (!(await tryConsume('brief'))) return fallback;

  try {
    const articleBlock = articles
      .map((a, i) => `${i + 1}. "${a.title}" (${a.sourceName}) — ${a.contentSnippet ?? ''}`)
      .join('\n');

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `You are writing a morning news briefing${language !== 'English' ? ` in ${language}` : ''}.

For each numbered story below, write one crisp ~50-word news summary in wire style${language !== 'English' ? ` in ${language}` : ''}. Lead with the most important fact. No opinions, no hedging.

${articleBlock}

Respond with ONLY a JSON array of strings — one summary per story, in order. No markdown, no keys, just: ["summary 1", "summary 2", ...]`,
    });

    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    const summaries: string[] = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const briefing: Briefing = {
      date,
      edition: editionKey,
      language,
      mode: 'ai',
      stories: articles.map((a, i) => ({
        title: a.title,
        summary: summaries[i] ?? truncate(a.contentSnippet, 60) ?? a.title,
        source: a.sourceName,
        link: a.link,
        pubDate: a.pubDate,
        imageUrl: a.imageUrl,
        category: a.category,
      })),
    };
    await cacheSet(cacheKey, JSON.stringify(briefing), BRIEF_TTL);
    return briefing;
  } catch {
    return fallback;
  }
}
