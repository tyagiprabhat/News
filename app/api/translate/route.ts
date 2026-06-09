import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { text, targetLanguage } = await req.json();

  if (!text || !targetLanguage) {
    return Response.json({ error: 'text and targetLanguage are required' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-opus-4-8'),
    messages: [
      {
        role: 'user',
        content: `Translate the following news text into ${targetLanguage}. Preserve proper nouns, place names, and organization names. Return only the translation, no notes or explanations.\n\n${text}`,
      },
    ],
  });

  return result.toTextStreamResponse();
}
