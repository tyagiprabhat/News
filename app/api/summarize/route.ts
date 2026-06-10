import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { buildSummarizePrompt } from '@/lib/summarize';
import { checkRateLimit, getIp } from '@/lib/rate-limit';
import { cacheGet, cacheSet, summaryKey } from '@/lib/cache';
import { tryConsume } from '@/lib/ai-budget';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SUMMARY_TTL = 24 * 60 * 60; // 24h

export async function POST(req: Request) {
  const { title, snippet, source, targetLanguage, wordCount, link } = await req.json();

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const words = Math.min(Math.max(Number(wordCount) || 60, 40), 120);
  const lang = targetLanguage || 'English';
  const key = link ? summaryKey(link, lang, words) : null;

  // Cache hit — return instantly, no AI call, no rate-limit cost.
  if (key) {
    const cached = await cacheGet(key);
    if (cached) {
      return new Response(cached, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  }

  // Cache miss — rate-limit the expensive generation path only.
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 30);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // Daily Gemini budget exhausted → degrade to the raw snippet, never error.
  if (!(await tryConsume('summarize'))) {
    const fallback = (snippet || title || '').toString().trim();
    return new Response(fallback, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: buildSummarizePrompt(title, snippet, source, targetLanguage, words) }],
    onFinish: async ({ text }) => {
      if (key && text.trim()) await cacheSet(key, text.trim(), SUMMARY_TTL);
    },
  });

  return result.toTextStreamResponse();
}
