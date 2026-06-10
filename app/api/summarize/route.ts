import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { buildSummarizePrompt } from '@/lib/summarize';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 30);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { title, snippet, source, targetLanguage, wordCount } = await req.json();

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const words = Math.min(Math.max(Number(wordCount) || 60, 40), 120);

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: buildSummarizePrompt(title, snippet, source, targetLanguage, words) }],
  });

  return result.toTextStreamResponse();
}
