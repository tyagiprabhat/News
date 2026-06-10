'use client';

import { useState } from 'react';
import { getPrefs } from '@/lib/prefs';

/* "Ask ✦" — per-story Q&A grounded in the story's coverage.
   Streams the answer using the same reader-loop pattern as
   useArticleAI in NewsFeed.tsx.                              */

const SUGGESTED = [
  'Why does this matter?',
  'What happens next?',
  'Who is affected?',
];

export default function StoryQA({
  story,
  onClose,
}: {
  story: { title: string; snippet?: string; sourceName: string };
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [streaming, setStreaming] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3 || streaming) return;
    setAsked(trimmed);
    setAnswer('');
    setStreaming(true);
    setQuestion('');
    try {
      const res = await fetch('/api/story/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          title: story.title,
          snippet: story.snippet,
          source: story.sourceName,
          language: getPrefs().lang,
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setAnswer('Could not reach the newsroom — try again in a moment.');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md glass border-t sm:border border-hairline sm:rounded-2xl p-5 max-h-[75%] flex flex-col"
        style={{ animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-sm font-semibold text-ink">Ask about this story</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm px-1">✕</button>
        </div>
        <p className="text-[11px] text-ink-muted mb-3 line-clamp-2">{story.title}</p>

        {/* Suggested questions */}
        {!asked && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs px-2.5 py-1.5 rounded-full border border-hairline text-ink-muted hover:text-ink hover:border-accent/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Answer */}
        {asked && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-1">
              {asked}
            </p>
            {answer ? (
              <p className="text-[14px] leading-relaxed text-ink border-l-2 border-accent pl-3 whitespace-pre-line">
                {answer}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[12px] text-ink-muted">
                <span className="inline-flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </span>
                Checking the coverage…
              </p>
            )}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); ask(question); }}
          className="flex gap-2 flex-shrink-0"
        >
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask anything about this story…"
            disabled={streaming}
            className="flex-1 bg-surface border border-hairline rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={streaming || question.trim().length < 3}
            className="bg-accent text-accent-ink rounded-xl px-3.5 py-2 text-sm font-medium disabled:opacity-40 hover:bg-accent-hover transition-colors"
          >
            ✦
          </button>
        </form>
      </div>
    </div>
  );
}
