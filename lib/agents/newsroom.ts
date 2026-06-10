import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { fetchNewsFeed, searchNews, type NewsItem } from '@/lib/news';

/* ── The Newsroom: a four-agent editorial pipeline ──────────────
   Desk Chief  — assigns the story and routes the work
   Wire Scout  — sweeps all live feeds for related coverage
   Analyst     — cross-source corroboration + why it matters
   Editor      — writes the final 60-word brief (streamed)

   Every handoff between agents is emitted as an event so the UI
   can render the conversation as it happens.                     */

export type AgentId = 'chief' | 'scout' | 'analyst' | 'editor';

export type NewsroomEvent =
  | { type: 'status'; agent: AgentId; state: 'working' | 'done' }
  | { type: 'message'; from: AgentId; to: AgentId; text: string }
  | { type: 'token'; text: string }
  | { type: 'error'; text: string }
  | { type: 'done' };

export interface NewsroomStory {
  title: string;
  snippet?: string;
  source?: string;
  link?: string;
}

const MODEL = google('gemini-2.5-flash');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'as', 'by', 'from', 'after', 'over', 'amid', 'into', 'is', 'are',
  'was', 'were', 'be', 'has', 'have', 'had', 'its', 'his', 'her', 'their',
  'this', 'that', 'new', 'says', 'say', 'said', 'will', 'would', 'could',
  'may', 'might', 'more', 'than', 'about', 'not', 'how', 'why', 'what',
  'when', 'who', 'amid', 'against',
]);

function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 5);
}

async function findRelatedCoverage(story: NewsroomStory): Promise<NewsItem[]> {
  const pool = await fetchNewsFeed(undefined, 60);
  const kw = keywords(story.title);
  // Progressively relax the query until something matches
  for (let n = Math.min(3, kw.length); n >= 1; n--) {
    const hits = searchNews(pool, kw.slice(0, n).join(' ')).filter(
      i => i.title !== story.title && i.link !== story.link
    );
    if (hits.length > 0) return hits.slice(0, 5);
  }
  return [];
}

export async function* runNewsroom(story: NewsroomStory): AsyncGenerator<NewsroomEvent> {
  const sourceName = story.source || 'the wires';

  /* 1 ── Desk Chief assigns the story */
  yield { type: 'status', agent: 'chief', state: 'working' };
  yield {
    type: 'message', from: 'chief', to: 'scout',
    text: `New story in from ${sourceName}: “${story.title}”. Sweep the wires — I want to know who else has this before we write a word.`,
  };
  yield { type: 'status', agent: 'chief', state: 'done' };

  /* 2 ── Wire Scout sweeps the live feeds */
  yield { type: 'status', agent: 'scout', state: 'working' };
  const related = await findRelatedCoverage(story);
  const wireList = related.length
    ? related.map(r => `- ${r.sourceName}: “${r.title}”`).join('\n')
    : '(no other outlet has this yet)';

  const scoutNote = await generateText({
    model: MODEL,
    prompt: `You are the Wire Scout in a newsroom. The Desk Chief asked you to check what other outlets have on this story:
"${story.title}" (filed by ${sourceName})

Related items you found across the live feeds:
${wireList}

Write your handoff note to the Analyst: 1–2 tight sentences on how widely this is being covered and by whom. Plain text, no preamble, no markdown.`,
  });
  yield { type: 'message', from: 'scout', to: 'analyst', text: scoutNote.text.trim() };
  yield { type: 'status', agent: 'scout', state: 'done' };

  /* 3 ── Analyst weighs corroboration */
  yield { type: 'status', agent: 'analyst', state: 'working' };
  const analysis = await generateText({
    model: MODEL,
    prompt: `You are the Analyst in a newsroom.

Story: "${story.title}" — ${story.snippet || 'no snippet available'} (filed by ${sourceName})
Wire Scout's note: ${scoutNote.text.trim()}
Related coverage:
${wireList}

Write your handoff note to the Editor: at most 3 sentences — what is corroborated vs single-source, and the one thing that makes this story matter. Plain text, no preamble, no markdown.`,
  });
  yield { type: 'message', from: 'analyst', to: 'editor', text: analysis.text.trim() };
  yield { type: 'status', agent: 'analyst', state: 'done' };

  /* 4 ── Editor writes the final brief, streamed token by token */
  yield { type: 'status', agent: 'editor', state: 'working' };
  const result = streamText({
    model: MODEL,
    prompt: `You are the Editor writing the final front-page brief.

Story: "${story.title}" — ${story.snippet || 'no snippet available'} (filed by ${sourceName})
Analyst's note: ${analysis.text.trim()}

Write exactly this, nothing else: a ~60-word news brief in crisp wire style (no headline), then on a new line "Why it matters: " followed by one sharp sentence. Plain text, no markdown.`,
  });
  for await (const token of result.textStream) {
    yield { type: 'token', text: token };
  }
  yield {
    type: 'message', from: 'editor', to: 'chief',
    text: `Brief filed — checked against ${related.length} related report${related.length === 1 ? '' : 's'} on the wires.`,
  };
  yield { type: 'status', agent: 'editor', state: 'done' };
  yield { type: 'done' };
}
