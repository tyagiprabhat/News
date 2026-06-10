import { runNewsroom } from '@/lib/agents/newsroom';
import { checkRateLimit, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Streams the multi-agent newsroom pipeline as NDJSON — one event per line —
// so the client can render agent handoffs live as they happen.
export async function POST(req: Request) {
  const { allowed, retryAfter } = checkRateLimit(getIp(req), 10);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const { title, snippet, source, link } = await req.json();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
      try {
        for await (const event of runNewsroom({ title, snippet, source, link })) {
          emit(event);
        }
      } catch {
        emit({ type: 'error', text: 'The newsroom hit a snag — try again in a moment.' });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
