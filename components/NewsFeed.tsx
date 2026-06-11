'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { CATEGORIES } from '@/lib/news';
import Newsroom from '@/components/Newsroom';
import FollowSheet from '@/components/FollowSheet';
import MorningBrief from '@/components/MorningBrief';
import CoverageBar from '@/components/CoverageBar';
import StoryQA from '@/components/StoryQA';
import { getPrefs, recordDwell, markRead, touchStreak } from '@/lib/prefs';
import { rankFeed } from '@/lib/ranking';
import type { Briefing } from '@/lib/briefing';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  imageUrl?: string;
  category: string;
  region: string;
  source: string;
  sourceName: string;
  sourceFlag: string;
  // Optional fields emitted for DB-backed (cluster-verified) stories
  _fromDB?: boolean;
  _storyId?: string;
  _clusterSize?: number;
  _countries?: number;
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.key, c.label])
);

function truncateWords(text: string | undefined, max: number): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text;
  return words.slice(0, max).join(' ') + '…';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function useArticleAI(item: NewsItem, wordCount: number) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLang, setSummaryLang] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const summarize = async (targetLanguage: string) => {
    setSummarizing(true);
    setAiSummary('');
    setSummaryLang(targetLanguage);
    try {
      const lang = targetLanguage === 'English' ? undefined : targetLanguage;
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, snippet: item.contentSnippet, source: item.sourceName, targetLanguage: lang, wordCount, link: item.link }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAiSummary(full);
      }
      // Empty stream (model unavailable) → fall back to the snippet
      if (!full.trim()) throw new Error();
    } catch {
      setAiSummary(null);
      setSummaryLang(null);
    } finally {
      setSummarizing(false);
    }
  };

  return { aiSummary, summaryLang, summarizing, summarize };
}

function AiDots() {
  return (
    <span className="inline-flex gap-0.5 items-center">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

/* ── Full-screen InShorts-style card ───────────────────────────── */

function FullScreenCard({ item, words, active, prefetch, onNewsroom }: { item: NewsItem; words: number; active: boolean; prefetch?: boolean; onNewsroom: () => void }) {
  const ai = useArticleAI(item, words);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const autoTried = useRef(false);

  // Pre-generate as soon as this card enters the on-deck position (pos=1).
  // When the user swipes, the summary is already streaming — or done.
  useEffect(() => {
    if (!prefetch || autoTried.current) return;
    autoTried.current = true;
    ai.summarize(getPrefs().lang || 'English');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetch]);

  // Front-of-stack: start summarize if prefetch didn't catch it, track dwell.
  useEffect(() => {
    if (!active) return;
    const enteredAt = Date.now();
    const readTimer = setTimeout(() => markRead(item.link), 3000);
    if (!autoTried.current) {
      autoTried.current = true;
      ai.summarize(getPrefs().lang || 'English');
    }
    return () => {
      clearTimeout(readTimer);
      recordDwell(item, Date.now() - enteredAt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const bodyText = ai.aiSummary ?? truncateWords(item.contentSnippet, words);
  const activeLang = ai.summaryLang;
  const isBreaking = item.category === 'conflict';

  // Density: short summaries get larger, airier type so the card never
  // feels half-empty on tall screens; long ones compact to fit.
  const bodyWords = bodyText ? bodyText.trim().split(/\s+/).length : 0;
  const bodyClass = bodyWords <= 45
    ? 'text-[17px] leading-[1.65] lg:text-[19px] lg:leading-[1.75]'
    : bodyWords <= 80
      ? 'text-[16px] leading-[1.6] lg:text-[18px] lg:leading-[1.7]'
      : 'text-[15px] leading-relaxed lg:text-[17px] lg:leading-[1.65]';

  return (
    <article className="h-full flex flex-col bg-canvas overflow-hidden">

      {/* ── Hero image ─────────────────────────────────────────── */}
      <div className="relative flex-shrink-0" style={{ height: '48%' }}>
        {item.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ease-spring ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full bg-surface2 flex items-center justify-center">
            <span className="text-6xl opacity-30">{item.sourceFlag}</span>
          </div>
        )}

        {/* Gradient fade into card body */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas to-transparent" />

        {/* Category kicker — top left */}
        <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 ${
          isBreaking
            ? 'bg-breaking text-white'
            : 'bg-canvas/80 backdrop-blur-sm text-accent'
        }`}>
          {isBreaking ? 'Breaking' : (CATEGORY_LABELS[item.category] ?? item.category)}
        </span>

        {/* Source badge — bottom left */}
        <span className="absolute bottom-2.5 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-ink/90 bg-canvas/75 backdrop-blur-sm px-2 py-0.5">
          {item.sourceFlag} {item.sourceName}
        </span>

        {/* Active language badge — bottom right */}
        {activeLang && activeLang !== 'English' && (
          <span className="absolute bottom-2.5 right-3 text-[11px] text-accent bg-canvas/75 backdrop-blur-sm px-2 py-0.5">
            🌐 {activeLang}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 lg:px-10 lg:pt-6 overflow-y-auto scrollbar-thin">

        {/* Title — editorial scale on desktop, à la front page */}
        <h2 className="font-display text-[23px] font-bold text-ink leading-[1.25] tracking-[-0.01em] lg:text-[36px] lg:leading-[1.15] lg:tracking-[-0.015em]">
          {item.title}
        </h2>

        {/* Cross-checked chip + coverage transparency */}
        {(item._clusterSize ?? 0) >= 2 && (
          <div className="mt-1.5 flex items-center gap-3">
            {(item._clusterSize ?? 0) >= 3 && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                ✓ Cross-checked
              </span>
            )}
            {item._storyId && (
              <CoverageBar
                storyId={item._storyId}
                clusterSize={item._clusterSize ?? 0}
                countries={item._countries ?? 0}
              />
            )}
          </div>
        )}

        {/* Body */}
        <div className="mt-3 flex-1">
          {(ai.summarizing && !ai.aiSummary) ? (
            <div className="space-y-2.5 pt-1" aria-label="Writing summary">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-[94%]" />
              <div className="skeleton h-4 w-[88%]" />
              <div className="skeleton h-4 w-[55%]" />
            </div>
          ) : bodyText ? (
            <p className={`${bodyClass} text-ink`}>
              {bodyText}
              {ai.summarizing && <span className="stream-caret" />}
            </p>
          ) : null}
        </div>

        {/* Meta row: time · source | Newsroom */}
        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-[11px] text-ink-muted truncate">
            {timeAgo(item.pubDate)} · {item.sourceName}
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setShowQA(true)}
              className="text-[11px] font-medium text-ink-muted hover:text-accent transition-colors"
            >
              Ask ✦
            </button>
            <button
              onClick={onNewsroom}
              className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
            >
              ✦ Newsroom
            </button>
          </div>
        </div>

        {showQA && (
          <StoryQA
            story={{ title: item.title, snippet: ai.aiSummary ?? item.contentSnippet, sourceName: item.sourceName }}
            onClose={() => setShowQA(false)}
          />
        )}

        {/* Read full story */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 mb-3.5 flex items-center justify-between text-sm font-semibold text-ink hover:text-accent transition-colors group flex-shrink-0"
        >
          <span className="uppercase tracking-wider text-xs">Read full story</span>
          <span className="text-accent group-hover:translate-x-0.5 transition-transform">→</span>
        </a>
      </div>
    </article>
  );
}

/* ── Feed container ────────────────────────────────────────────── */

export default function NewsFeed({ words = 60, edition = 'US:en' }: { words?: number; edition?: string }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [followItems, setFollowItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [newsroomStory, setNewsroomStory] = useState<NewsItem | null>(null);
  const [showFollows, setShowFollows] = useState(false);
  const [prefsVersion, setPrefsVersion] = useState(0);

  // Daily streak tick + morning brief on first session of the day
  const [brief, setBrief] = useState<Briefing | null>(null);
  const [catchUp, setCatchUp] = useState(false);

  useEffect(() => {
    const lastVisitBefore = getPrefs().lastVisit;
    touchStreak();
    const today = new Date().toISOString().slice(0, 10);
    let shown: string | null = null;
    try { shown = localStorage.getItem('breve:brief-shown'); } catch {}
    if (shown === today) return;

    const gapHours = lastVisitBefore > 0 ? (Date.now() - lastVisitBefore) / 3_600_000 : 0;
    setCatchUp(gapHours > 12);

    (async () => {
      try {
        const lang = getPrefs().lang || 'English';
        const res = await fetch(`/api/brief?edition=${edition}&lang=${encodeURIComponent(lang)}`);
        if (!res.ok) return;
        const b: Briefing = await res.json();
        if (b.stories?.length >= 3) {
          setBrief(b);
          try { localStorage.setItem('breve:brief-shown', today); } catch {}
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const entities = getPrefs().follows.filter(f => f.type === 'entity').slice(0, 3);
    if (entities.length === 0) { setFollowItems([]); return; }
    let cancelled = false;
    (async () => {
      const batches = await Promise.allSettled(
        entities.map(f =>
          fetch(`/api/discover?q=${encodeURIComponent(f.value)}&edition=${edition}&limit=4`)
            .then(r => r.json())
        )
      );
      if (cancelled) return;
      const merged: NewsItem[] = [];
      for (const b of batches) {
        if (b.status === 'fulfilled' && Array.isArray(b.value.items)) merged.push(...b.value.items);
      }
      setFollowItems(merged);
    })();
    return () => { cancelled = true; };
  }, [edition, prefsVersion]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '15' });
      if (edition && edition !== 'US:en') params.set('edition', edition);
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [edition]);

  useEffect(() => { fetchNews(); }, [fetchNews, edition]);

  const visible = useMemo(() => {
    if (category !== 'all') return items.filter(i => i.category === category);
    // My Feed: merge followed-entity stories, rank by personal signals
    const prefs = getPrefs();
    const seen = new Set(items.map(i => i.link));
    const merged = [...items, ...followItems.filter(i => i.link && !seen.has(i.link))];
    return rankFeed(merged, {
      affinity: prefs.affinity,
      follows: prefs.follows,
      readLinks: prefs.readLinks,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, followItems, category, prefsVersion]);

  /* ── Card stack: real cards, real physics ─────────────────────
     Cards live in a stack: the next card peeks from behind at 94%
     scale. Touch drags the front card with your finger (rubber-band
     at the ends); release past the threshold springs it off and
     promotes the card beneath. Wheel, arrows and chevrons drive the
     same transitions on desktop.                                   */
  const stackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [drag, setDrag] = useState(0);
  const draggingRef = useRef(false);
  const animating = useRef(false);
  const newsroomOpen = useRef(false);
  newsroomOpen.current = newsroomStory !== null;

  const briefVisible = !!brief && category === 'all';
  const totalCards = visible.length + (briefVisible ? 1 : 0);
  const totalRef = useRef(0);
  totalRef.current = totalCards;

  const goTo = useCallback((i: number, total: number) => {
    const next = Math.max(0, Math.min(i, total - 1));
    if (next === indexRef.current) { setDrag(0); return; }
    animating.current = true;
    indexRef.current = next;
    setIndex(next);
    setDrag(0);
    window.setTimeout(() => { animating.current = false; }, 520);
  }, []);

  // Let inner scrollable content (long card bodies) consume a gesture
  // while it can still move in that direction.
  const innerCanScroll = useCallback((target: HTMLElement | null, down: boolean): boolean => {
    let el = target;
    const stack = stackRef.current;
    while (el && el !== stack) {
      if (el.scrollHeight > el.clientHeight + 1) {
        const ok = down
          ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
          : el.scrollTop > 0;
        if (ok) return true;
      }
      el = el.parentElement;
    }
    return false;
  }, []);

  // Touch: the front card follows the finger
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    let startY = 0, startX = 0, startT = 0;
    let mode: 'idle' | 'drag' | 'native' = 'idle';

    const onStart = (e: TouchEvent) => {
      if (animating.current) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startT = Date.now();
      mode = 'idle';
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'native') return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (mode === 'idle') {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        // Horizontal intent (tab bar etc.) or scrollable inner content win
        if (Math.abs(dx) > Math.abs(dy) || innerCanScroll(e.target as HTMLElement, dy < 0)) {
          mode = 'native';
          return;
        }
        mode = 'drag';
        draggingRef.current = true;
      }
      e.preventDefault();
      const rubber = (indexRef.current === 0 && dy > 0)
        || (indexRef.current >= totalRef.current - 1 && dy < 0);
      setDrag(rubber ? dy * 0.3 : dy);
    };
    const onEnd = (e: TouchEvent) => {
      if (mode !== 'drag') { mode = 'idle'; return; }
      mode = 'idle';
      draggingRef.current = false;
      const dy = e.changedTouches[0].clientY - startY;
      const velocity = dy / Math.max(1, Date.now() - startT); // px/ms
      const commit = Math.abs(dy) > stack.clientHeight * 0.22 || Math.abs(velocity) > 0.55;
      if (commit) {
        goTo(indexRef.current + (dy < 0 ? 1 : -1), totalRef.current);
      } else {
        setDrag(0);
      }
    };

    stack.addEventListener('touchstart', onStart, { passive: true });
    stack.addEventListener('touchmove', onMove, { passive: false });
    stack.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      stack.removeEventListener('touchstart', onStart);
      stack.removeEventListener('touchmove', onMove);
      stack.removeEventListener('touchend', onEnd);
    };
  }, [goTo, innerCanScroll]);

  // Wheel: one gesture = one card (desktop)
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || !window.matchMedia('(pointer: fine)').matches) return;
    const onWheel = (e: WheelEvent) => {
      if (innerCanScroll(e.target as HTMLElement, e.deltaY > 0)) return;
      e.preventDefault();
      if (animating.current || Math.abs(e.deltaY) < 8) return;
      goTo(indexRef.current + (e.deltaY > 0 ? 1 : -1), totalRef.current);
    };
    stack.addEventListener('wheel', onWheel, { passive: false });
    return () => stack.removeEventListener('wheel', onWheel);
  }, [goTo, innerCanScroll]);

  // Keyboard paging: ↑/↓, PageUp/Down, j/k, Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (newsroomOpen.current) return;
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
      if (['ArrowDown', 'PageDown', 'j', ' '].includes(e.key)) {
        e.preventDefault();
        goTo(indexRef.current + 1, totalRef.current);
      } else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) {
        e.preventDefault();
        goTo(indexRef.current - 1, totalRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  // New category = back to the top of the stack
  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    setDrag(0);
  }, [category]);

  /* Resting/dragging transforms for each stack layer. pos is the card's
     offset from the front: -1 sits above offscreen, 0 is front, 1 peeks
     behind at 94% scale, 2 is the deep layer.                          */
  const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const cardStyle = (pos: number): CSSProperties => {
    const dragging = draggingRef.current;
    const t = dragging
      ? 'none'
      : `transform 0.5s ${SPRING}, opacity 0.5s ${SPRING}, border-radius 0.5s ${SPRING}, box-shadow 0.5s ${SPRING}`;
    const h = stackRef.current?.clientHeight ?? 800;
    const pull = Math.max(0, drag);                    // downward: reveal prev
    const p = Math.min(1, Math.max(0, -drag) / (h * 0.6)); // upward: promote next
    const lifted = '0 18px 48px rgb(0 0 0 / 0.5)';
    if (pos === -1) return {
      transform: `translateY(calc(-104% + ${pull}px))`,
      zIndex: 30, transition: t, borderRadius: 24, boxShadow: lifted,
    };
    if (pos === 0) return {
      transform: `translateY(${drag}px)`,
      zIndex: 20, transition: t,
      borderRadius: drag === 0 ? 0 : 20,
      boxShadow: drag === 0 ? 'none' : lifted,
    };
    if (pos === 1) return {
      transform: `translateY(${16 * (1 - p)}px) scale(${0.94 + 0.06 * p})`,
      zIndex: 10, transition: t, borderRadius: 20 * (1 - p),
    };
    return {
      transform: 'translateY(16px) scale(0.94)',
      zIndex: 5, transition: t, borderRadius: 20, opacity: 0.85,
    };
  };

  const spinner = (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const empty = <p className="text-center text-ink-muted text-sm p-8">No articles in this view right now.</p>;

  return (
    <div className="relative flex flex-col h-full bg-canvas">

      {/* ── Card stack ───────────────────────────────────────── */}
      <div ref={stackRef} data-deck className="relative flex-1 min-h-0 overflow-hidden overscroll-contain">
        {loading ? spinner : totalCards === 0 ? empty : (
          (briefVisible ? [null, ...visible] : visible).map((item, i) => {
            const pos = i - index;
            if (pos < -1 || pos > 2) return null;
            const isBrief = item === null;
            return (
              <div
                key={isBrief ? 'brief' : `${item.link}-${i}`}
                className="absolute inset-0 overflow-hidden bg-canvas will-change-transform"
                style={cardStyle(pos)}
              >
                {isBrief ? (
                  <MorningBrief briefing={brief!} catchUp={catchUp} edition={edition} />
                ) : (
                  <FullScreenCard
                    item={item}
                    words={words}
                    active={pos === 0}
                    prefetch={pos === 1}
                    onNewsroom={() => setNewsroomStory(item)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Bottom brand + category nav ──────────────────────── */}
      <div className="flex-shrink-0 flex items-center h-12 glass-nav border-t border-hairline/40 z-20">
        {/* Brève wordmark */}
        <div className="flex-shrink-0 flex flex-col leading-none pl-4 pr-3 border-r border-hairline/40">
          <span className="font-display text-[13px] font-semibold tracking-tight text-accent">Brève</span>
          <span className="rule-accent w-8 mt-0.5" />
        </div>
        {/* Scrollable category pills */}
        <div className="flex-1 overflow-x-auto scrollbar-none flex items-center px-1">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-2.5 py-1 mx-0.5 my-1.5 text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap flex-shrink-0 rounded-full transition-colors ${
                category === key
                  ? 'bg-accent/15 text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Action icons */}
        <div className="flex-shrink-0 flex items-center pr-1 border-l border-hairline/40">
          <button
            onClick={() => setShowFollows(true)}
            className="w-10 h-12 flex items-center justify-center text-ink-muted hover:text-accent transition-colors text-base"
            title="Manage follows"
          >
            ☆
          </button>
          <button
            onClick={fetchNews}
            className="w-10 h-12 flex items-center justify-center text-ink-muted hover:text-accent transition-colors text-base"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Desktop pager: chevrons + counter on the right edge ── */}
      {!loading && visible.length > 0 && (
        <div className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-2">
          <button
            onClick={() => goTo(index - 1, totalCards)}
            disabled={index === 0}
            aria-label="Previous story"
            className="glass border border-hairline rounded-full w-9 h-9 flex items-center justify-center text-ink-muted hover:text-ink hover:border-accent disabled:opacity-30 disabled:pointer-events-none transition-colors ease-spring"
          >
            ↑
          </button>
          <span className="text-[10px] text-ink-muted tabular-nums glass border border-hairline rounded-full px-2 py-0.5">
            {index + 1} / {totalCards}
          </span>
          <button
            onClick={() => goTo(index + 1, totalCards)}
            disabled={index >= totalCards - 1}
            aria-label="Next story"
            className="glass border border-hairline rounded-full w-9 h-9 flex items-center justify-center text-ink-muted hover:text-ink hover:border-accent disabled:opacity-30 disabled:pointer-events-none transition-colors ease-spring"
          >
            ↓
          </button>
        </div>
      )}

      {/* ── Follow management sheet ──────────────────────────── */}
      {showFollows && (
        <FollowSheet
          onClose={() => setShowFollows(false)}
          onChange={() => setPrefsVersion(v => v + 1)}
        />
      )}

      {/* ── Live agent newsroom ──────────────────────────────── */}
      {newsroomStory && (
        <Newsroom
          story={{
            title: newsroomStory.title,
            snippet: newsroomStory.contentSnippet,
            sourceName: newsroomStory.sourceName,
            link: newsroomStory.link,
          }}
          onClose={() => setNewsroomStory(null)}
        />
      )}
    </div>
  );
}
