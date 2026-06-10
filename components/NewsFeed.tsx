'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CATEGORIES } from '@/lib/news';
import Newsroom from '@/components/Newsroom';
import FollowSheet from '@/components/FollowSheet';
import MorningBrief from '@/components/MorningBrief';
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
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiSummary(prev => (prev ?? '') + decoder.decode(value, { stream: true }));
      }
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

function FullScreenCard({ item, words, onNewsroom }: { item: NewsItem; words: number; onNewsroom: () => void }) {
  const ai = useArticleAI(item, words);
  const [imgFailed, setImgFailed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const autoTried = useRef(false);

  // Auto-summarize in the user's language on view + dwell-time tracking
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let enteredAt = 0;
    let readTimer: ReturnType<typeof setTimeout> | null = null;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            enteredAt = Date.now();
            readTimer = setTimeout(() => markRead(item.link), 3000);
            if (!autoTried.current) {
              autoTried.current = true;
              ai.summarize(getPrefs().lang || 'English');
            }
          } else if (enteredAt > 0) {
            if (readTimer) clearTimeout(readTimer);
            recordDwell(item, Date.now() - enteredAt);
            enteredAt = 0;
          }
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => {
      if (readTimer) clearTimeout(readTimer);
      if (enteredAt > 0) recordDwell(item, Date.now() - enteredAt);
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyText = ai.aiSummary ?? truncateWords(item.contentSnippet, words);
  const activeLang = ai.summaryLang;
  const isBreaking = item.category === 'conflict';

  return (
    <article ref={cardRef} className="snap-start h-full flex flex-col bg-canvas overflow-hidden">

      {/* ── Hero image ─────────────────────────────────────────── */}
      <div className="relative flex-shrink-0" style={{ height: '44%' }}>
        {item.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface2 flex items-center justify-center">
            <span className="text-6xl opacity-30">{item.sourceFlag}</span>
          </div>
        )}

        {/* Gradient fade into card body */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas to-transparent" />

        {/* Category kicker — top left, clears the frosted tab bar */}
        <span className={`absolute top-12 left-3 text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 ${
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
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 overflow-y-auto scrollbar-thin">

        {/* Title */}
        <h2 className="font-display text-[21px] font-bold text-ink leading-snug">
          {item.title}
        </h2>

        {/* Body */}
        <div className="mt-3 flex-1">
          {(ai.summarizing && !ai.aiSummary) ? (
            <p className="text-[15px] text-ink-muted leading-relaxed flex items-center gap-2">
              <AiDots /> Writing summary…
            </p>
          ) : bodyText ? (
            <p className="text-[15px] leading-relaxed text-ink">
              {bodyText}
            </p>
          ) : null}
        </div>

        {/* Meta row: time · source | Newsroom */}
        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-[11px] text-ink-muted truncate">
            {timeAgo(item.pubDate)} · {item.sourceName}
          </p>
          <button
            onClick={onNewsroom}
            className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors flex-shrink-0"
          >
            ✦ Newsroom
          </button>
        </div>

        {/* Read full story */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 mb-4 flex items-center justify-between text-sm font-semibold text-ink hover:text-accent transition-colors group flex-shrink-0"
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

  /* ── Deck pager: one gesture = one card ───────────────────────
     Touch keeps native snap scrolling. On desktop (fine pointer)
     the wheel is intercepted so a single scroll gesture advances
     exactly one card, with arrow keys and chevrons as well.      */
  const deckRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const animating = useRef(false);
  const newsroomOpen = useRef(false);
  newsroomOpen.current = newsroomStory !== null;

  const goTo = useCallback((i: number, total: number) => {
    const deck = deckRef.current;
    if (!deck) return;
    const next = Math.max(0, Math.min(i, total - 1));
    if (next === indexRef.current && deck.scrollTop === next * deck.clientHeight) return;
    animating.current = true;
    indexRef.current = next;
    setIndex(next);
    deck.scrollTo({ top: next * deck.clientHeight, behavior: 'smooth' });
    window.setTimeout(() => { animating.current = false; }, 550);
  }, []);

  const briefVisible = !!brief && category === 'all';
  const totalCards = visible.length + (briefVisible ? 1 : 0);
  const totalRef = useRef(0);
  totalRef.current = totalCards;

  // Wheel paging — non-passive listener so we can preventDefault
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !window.matchMedia('(pointer: fine)').matches) return;

    const onWheel = (e: WheelEvent) => {
      // Let inner scrollable content (long card bodies) consume the
      // gesture while it can still move in that direction.
      let el = e.target as HTMLElement | null;
      while (el && el !== deck) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const down = e.deltaY > 0;
          const canScroll = down
            ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
            : el.scrollTop > 0;
          if (canScroll) return;
        }
        el = el.parentElement;
      }
      e.preventDefault();
      if (animating.current || Math.abs(e.deltaY) < 8) return;
      goTo(indexRef.current + (e.deltaY > 0 ? 1 : -1), totalRef.current);
    };

    deck.addEventListener('wheel', onWheel, { passive: false });
    return () => deck.removeEventListener('wheel', onWheel);
  }, [goTo]);

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

  // Keep the counter honest when touch / native snap moves the deck
  const onDeckScroll = useCallback(() => {
    const deck = deckRef.current;
    if (!deck || animating.current || deck.clientHeight === 0) return;
    const i = Math.round(deck.scrollTop / deck.clientHeight);
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
    }
  }, []);

  // New category = back to the top of the deck
  useEffect(() => {
    const deck = deckRef.current;
    if (deck) deck.scrollTop = 0;
    indexRef.current = 0;
    setIndex(0);
  }, [category]);

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

      {/* ── Category tabs — frosted glass, cards scroll beneath ── */}
      <div className="absolute top-0 inset-x-0 z-20 flex overflow-x-auto scrollbar-none border-b border-hairline glass">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap flex-shrink-0 border-b-2 -mb-px transition-colors ${
              category === key
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowFollows(true)}
          className="ml-auto px-3 py-2.5 text-ink-muted hover:text-accent transition-colors flex-shrink-0 text-sm"
          title="Manage follows"
        >
          ☆
        </button>
        <button
          onClick={fetchNews}
          className="px-3 py-2.5 text-ink-muted hover:text-accent transition-colors flex-shrink-0 text-sm"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* ── Swipe deck ───────────────────────────────────────── */}
      <div
        ref={deckRef}
        onScroll={onDeckScroll}
        className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-none"
      >
        {loading ? spinner : visible.length === 0 ? empty : (
          <>
            {briefVisible && brief && (
              <MorningBrief briefing={brief} catchUp={catchUp} edition={edition} />
            )}
            {visible.map((item, i) => (
              <FullScreenCard
                key={`${item.link}-${i}`}
                item={item}
                words={words}
                onNewsroom={() => setNewsroomStory(item)}
              />
            ))}
          </>
        )}
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
