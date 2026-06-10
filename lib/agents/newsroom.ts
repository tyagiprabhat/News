import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { fetchNewsFeed, searchNews, type NewsItem } from '@/lib/news';
import { expandStory, keywords } from '@/lib/agents/scout';

/* ── The Newsroom: a four-agent editorial pipeline ──────────────
   Desk Chief  — assigns the story and routes the work
   Wire Scout  — sweeps curated feeds PLUS Google News globally
   Analyst     — cross-source corroboration + why it matters
   Editor      — writes the final 60-word brief (streamed)

   Scout & Analyst use flash-lite (saves quota).
   Editor uses full flash (user-visible prose).               */

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

const LITE_MODEL = google('gemini-2.5-flash');   // scout + analyst
const EDITOR_MODEL = google('gemini-2.5-flash'); // editor (streamed prose)

async function findRelatedCoverage(story: NewsroomStory): Promise<{
  curated: NewsItem[];
  global: NewsItem[];
  countries: string[];
  publishers: string[];
}> {
  // 1. Curated backbone — fast in-memory search
  const pool = await fetchNewsFeed(undefined, 60);
  const kw = keywords(story.title);
  let curated: NewsItem[] = [];
  for (let n = Math.min(3, kw.length); n >= 1; n--) {
    const hits = searchNews(pool, kw.slice(0, n).join(' ')).filter(
      i => i.title !== story.title && i.link !== story.link
    );
    if (hits.length > 0) { curated = hits.slice(0, 5); break; }
  }

  // 2. Google News global sweep (no Gemini, deterministic)
  const report = await expandStory(story);

  return {
    curated,
    global: report.items,
    countries: report.countries,
    publishers: report.publishers,
  };
}

export async function* runNewsroom(story: NewsroomStory): AsyncGenerator<NewsroomEvent> {
  const sourceName = story.source || 'the wires';

  /* 1 ── Desk Chief assigns the story */
  yield { type: 'status', agent: 'chief', state: 'working' };
  yield {
    type: 'message', from: 'chief', to: 'scout',
    text: `New story in from ${sourceName}: "${story.title}". Sweep the wires globally — I want to know who else has this before we write a word.`,
  };
  yield { type: 'status', agent: 'chief', state: 'done' };

  /* 2 ── Wire Scout sweeps curated + Google News */
  yield { type: 'status', agent: 'scout', state: 'working' };
  const { curated, global, countries, publishers } = await findRelatedCoverage(story);

  const all = [...curated, ...global];
  const wireList = all.length
    ? all.slice(0, 8).map(r => `- ${r.sourceName}: "${r.title}"`).join('\n')
    : '(no other outlet has this yet)';

  const coverageContext = all.length
    ? `Found ${all.length} related reports (${curated.length} curated + ${global.length} global) across ${countries.length} countries from: ${publishers.slice(0, 6).join(', ')}.`
    : 'No related coverage found in the feeds.';

  const scoutNote = await generateText({
    model: LITE_MODEL,
    prompt: `You are the Wire Scout in a newsroom. The Desk Chief asked you to check what other outlets have on this story:
"${story.title}" (filed by ${sourceName})

Coverage you found:
${wireList}

${coverageContext}

Write your handoff note to the Analyst: 1–2 tight sentences on how widely this is being covered, which countries and by whom. Plain text, no preamble, no markdown.`,
  });
  yield { type: 'message', from: 'scout', to: 'analyst', text: scoutNote.text.trim() };
  yield { type: 'status', agent: 'scout', state: 'done' };

  /* 3 ── Analyst weighs corroboration */
  yield { type: 'status', agent: 'analyst', state: 'working' };
  const analysis = await generateText({
    model: LITE_MODEL,
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
    model: EDITOR_MODEL,
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
    text: `Brief filed — checked against ${all.length} report${all.length === 1 ? '' : 's'} across ${countries.length > 0 ? countries.join(', ') : 'the feeds'}.`,
  };
  yield { type: 'status', agent: 'editor', state: 'done' };
  yield { type: 'done' };
}
