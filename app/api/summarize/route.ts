import { anthropic } from '@ai-sdk/anthropic';
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

  const { title, snippet, source, targetLanguage } = await req.json();

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    messages: [{ role: 'user', content: buildSummarizePrompt(title, snippet, source, targetLanguage) }],
  });

  return result.toTextStreamResponse();
}
