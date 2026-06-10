'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Live newsroom panel ─────────────────────────────────────────
   Streams the four-agent pipeline from /api/newsroom and renders
   every handoff as it happens: who is working, who said what to
   whom, and the Editor's final brief arriving token by token.    */

type AgentId = 'chief' | 'scout' | 'analyst' | 'editor';
type AgentState = 'idle' | 'working' | 'done';

interface HandoffMsg {
  from: AgentId;
  to: AgentId;
  text: string;
}

const AGENTS: Record<AgentId, { name: string; initials: string; role: string }> = {
  chief:   { name: 'Desk Chief', initials: 'DC', role: 'assigns the story' },
  scout:   { name: 'Wire Scout', initials: 'WS', role: 'sweeps the feeds' },
  analyst: { name: 'Analyst',    initials: 'AN', role: 'checks corroboration' },
  editor:  { name: 'Editor',     initials: 'ED', role: 'writes the brief' },
};

const AGENT_ORDER: AgentId[] = ['chief', 'scout', 'analyst', 'editor'];

interface NewsroomProps {
  story: { title: string; snippet?: string; sourceName: string; link: string };
  onClose: () => void;
}

export default function Newsroom({ story, onClose }: NewsroomProps) {
  const [states, setStates] = useState<Record<AgentId, AgentState>>({
    chief: 'idle', scout: 'idle', analyst: 'idle', editor: 'idle',
  });
  const [messages, setMessages] = useState<HandoffMsg[]>([]);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/newsroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: story.title,
            snippet: story.snippet,
            source: story.sourceName,
            link: story.link,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.type === 'status') {
              setStates(prev => ({ ...prev, [ev.agent]: ev.state }));
            } else if (ev.type === 'message') {
              setMessages(prev => [...prev, ev]);
            } else if (ev.type === 'token') {
              setBrief(prev => prev + ev.text);
            } else if (ev.type === 'error') {
              setError(ev.text);
            } else if (ev.type === 'done') {
              setFinished(true);
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Could not reach the newsroom — try again in a moment.');
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the conversation pinned to the latest handoff
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, brief]);

  const anyWorking = AGENT_ORDER.some(a => states[a] === 'working');

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg h-[78%] sm:h-[72%] glass border-t sm:border border-hairline sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ animation: 'sheetUp 0.45s cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-accent">✦</span>
            <h2 className="font-display text-sm font-semibold text-ink">The Newsroom</h2>
            {anyWorking && (
              <span className="text-[10px] uppercase tracking-wider text-accent animate-pulse">live</span>
            )}
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors text-sm px-2">
            ✕
          </button>
        </div>

        {/* Agent roster */}
        <div className="flex justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
          {AGENT_ORDER.map(id => {
            const s = states[id];
            return (
              <div key={id} className="flex flex-col items-center gap-1 w-1/4">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors ease-spring ${
                    s === 'working'
                      ? 'border-accent text-accent animate-pulse'
                      : s === 'done'
                        ? 'border-hairline bg-surface text-ink'
                        : 'border-hairline text-ink-muted'
                  }`}
                >
                  {s === 'done' ? '✓' : AGENTS[id].initials}
                </span>
                <span className={`text-[9px] uppercase tracking-wider ${s === 'working' ? 'text-accent' : 'text-ink-muted'}`}>
                  {AGENTS[id].name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Handoff feed */}
        <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
          <p className="text-[11px] text-ink-muted leading-relaxed border-l-2 border-hairline pl-2.5">
            Working the story: “{story.title}”
          </p>

          {messages.map((m, i) => (
            <div key={i}>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-1">
                {AGENTS[m.from].name} <span className="text-accent">→</span> {AGENTS[m.to].name}
              </p>
              <p className="text-[13px] leading-relaxed text-ink">{m.text}</p>
            </div>
          ))}

          {/* Editor's brief streams in as the reward moment */}
          {brief && (
            <div className="border-l-2 border-accent pl-3 py-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-accent mb-1">
                Final brief
              </p>
              <p className="text-[14px] leading-relaxed text-ink whitespace-pre-line">{brief}</p>
            </div>
          )}

          {anyWorking && !brief && (
            <p className="flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
              {AGENTS[AGENT_ORDER.find(a => states[a] === 'working') ?? 'chief'].name} is {AGENTS[AGENT_ORDER.find(a => states[a] === 'working') ?? 'chief'].role}…
            </p>
          )}

          {error && <p className="text-[12px] text-breaking">{error}</p>}
          {finished && (
            <p className="text-[10px] uppercase tracking-wider text-ink-muted pt-1">— filed —</p>
          )}
        </div>
      </div>
    </div>
  );
}
