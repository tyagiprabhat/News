import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { title, snippet, source } = await req.json();

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    messages: [
      {
        role: 'user',
        content: `Write a punchy, engaging 60-word news summary in InShorts style. Start directly with the most important fact — no "this article says", no fluff. Be factual and vivid. Exactly around 60 words.

Source: ${source || 'News'}
Headline: ${title}
${snippet ? `Content: ${snippet}` : ''}`,
      },
    ],
  });

  return result.toTextStreamResponse();
}
