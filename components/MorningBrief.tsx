'use client';

import { useState } from 'react';
import { subscribePush } from '@/components/SwRegister';
import type { Briefing } from '@/lib/briefing';

/* ── Morning Brief — the daily habit anchor ─────────────────────────
   Rendered as the first card of the deck on the user's first session
   of the day. A dated masthead + 5 ranked stories, plus a contextual
   push opt-in (never a cold browser prompt).                        */

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function MorningBrief({
  briefing,
  catchUp,
  edition,
}: {
  briefing: Briefing;
  catchUp: boolean;
  edition: string;
}) {
  const [pushState, setPushState] = useState<'idle' | 'pending' | 'done' | 'hidden'>(() => {
    if (typeof window === 'undefined') return 'hidden';
    const supported = 'Notification' in window && 'PushManager' in window
      && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!supported || Notification.permission !== 'default') return 'hidden';
    if (localStorage.getItem('breve:push-dismissed')) return 'hidden';
    return 'idle';
  });

  const handlePush = async () => {
    setPushState('pending');
    const ok = await subscribePush(edition);
    setPushState(ok ? 'done' : 'idle');
  };

  const dismissPush = () => {
    try { localStorage.setItem('breve:push-dismissed', '1'); } catch {}
    setPushState('hidden');
  };

  return (
    <section className="snap-start h-full flex flex-col bg-canvas overflow-hidden">
      {/* Masthead */}
      <div className="flex-shrink-0 px-5 pt-16 pb-4 border-b border-hairline">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-1">
          {catchUp ? 'While you were away' : 'Your Morning Brief'}
        </p>
        <h2 className="font-display text-2xl font-bold text-ink leading-tight">
          {formatDate()}
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {briefing.stories.length} stories · {briefing.language}
        </p>
      </div>

      {/* Stories */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-3 space-y-4">
        {briefing.stories.map((story, i) => (
          <a
            key={story.link}
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex gap-3">
              <span className="font-display text-lg font-bold text-accent/60 flex-shrink-0 leading-tight">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-ink leading-snug group-hover:text-accent transition-colors">
                  {story.title}
                </h3>
                <p className="text-[12.5px] text-ink-muted leading-relaxed mt-1 line-clamp-3">
                  {story.summary}
                </p>
                <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wider">
                  {story.source}
                </p>
              </div>
            </div>
            {i < briefing.stories.length - 1 && <div className="rule-accent mt-4 opacity-40" />}
          </a>
        ))}
      </div>

      {/* Contextual push opt-in */}
      {pushState !== 'hidden' && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-hairline flex items-center justify-between gap-3">
          {pushState === 'done' ? (
            <p className="text-xs text-accent">✓ You&apos;ll get your brief every morning.</p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">Get this brief at 7am, every day.</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handlePush}
                  disabled={pushState === 'pending'}
                  className="text-xs bg-accent text-accent-ink px-3 py-1.5 rounded-full font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {pushState === 'pending' ? '…' : '🔔 Notify me'}
                </button>
                <button onClick={dismissPush} className="text-ink-muted text-xs px-1">✕</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Swipe hint */}
      <p className="flex-shrink-0 text-center text-[10px] text-ink-muted uppercase tracking-[0.2em] pb-3">
        Swipe up for your feed ↑
      </p>
    </section>
  );
}
