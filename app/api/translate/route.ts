import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { buildTranslatePrompt } from '@/lib/translate';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { text, targetLanguage, sourceLanguage } = await req.json();

  if (!text || !targetLanguage) {
    return Response.json({ error: 'text and targetLanguage are required' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-opus-4-8'),
    messages: [{ role: 'user', content: buildTranslatePrompt(text, targetLanguage, sourceLanguage) }],
  });

  return result.toTextStreamResponse();
}
