import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { checkRateLimit, getIp } from '@/lib/rate-limit';
import { tryConsume } from '@/lib/ai-budget';

export const runtime = 'nodejs';
export const maxDuration = 30;

/* Per-story Q&A — grounded strictly in the provided coverage.
   The prompt instructs the model to say what the coverage doesn't
   establish rather than hallucinate.                              */
export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 5);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { question, title, snippet, source, coverageTitles, language } = await req.json();
  if (!question || !title) {
    return Response.json({ error: 'question and title are required' }, { status: 400 });
  }

  if (!(await tryConsume('qa'))) {
    return new Response(
      'The newsroom is at capacity for today — try again tomorrow.',
      { headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  const coverage = Array.isArray(coverageTitles) && coverageTitles.length > 0
    ? `\nRelated coverage headlines:\n${coverageTitles.slice(0, 8).map((t: string) => `- ${t}`).join('\n')}`
    : '';

  const result = streamText({
    model: google('gemini-2.5-flash'),
    prompt: `You are answering a reader's question about a news story. Ground your answer ONLY in the context below. If the coverage doesn't establish the answer, say exactly what is and isn't known — do not speculate or use outside knowledge.${language && language !== 'English' ? ` Answer in ${language}.` : ''}

Story: "${title}"
Summary: ${snippet || 'not available'}
Source: ${source || 'unknown'}${coverage}

Reader's question: ${String(question).slice(0, 300)}

Answer in 2-4 sentences, plain text, no markdown.`,
  });

  return result.toTextStreamResponse();
}
