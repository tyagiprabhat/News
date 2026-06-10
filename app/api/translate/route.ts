import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { buildTranslatePrompt } from '@/lib/translate';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 20);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { text, targetLanguage, sourceLanguage } = await req.json();

  if (!text || !targetLanguage) {
    return Response.json({ error: 'text and targetLanguage are required' }, { status: 400 });
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: buildTranslatePrompt(text, targetLanguage, sourceLanguage) }],
  });

  return result.toTextStreamResponse();
}
