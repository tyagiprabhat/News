'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CATEGORIES } from '@/lib/news';

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

const SUMMARY_LANGS = [
  { code: 'EN', label: 'English', flag: '🇺🇸' },
  { code: 'FR', label: 'French',  flag: '🇫🇷' },
  { code: 'DE', label: 'German',  flag: '🇩🇪' },
  { code: 'ES', label: 'Spanish', flag: '🇪🇸' },
  { code: 'AR', label: 'Arabic',  flag: '🇸🇦' },
  { code: 'HI', label: 'Hindi',   flag: '🇮🇳' },
  { code: 'IT', label: 'Italian', flag: '🇮🇹' },
];

const TRANSLATE_LANGS = ['French', 'German', 'Spanish', 'Arabic', 'Hindi', 'Portuguese', 'Italian', 'English'];

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
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translateLang, setTranslateLang] = useState<string | null>(null);

  const summarize = async (targetLanguage: string) => {
    setSummarizing(true);
    setAiSummary('');
    setSummaryLang(targetLanguage);
    setTranslated(null);
    setTranslateLang(null);
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

  const translate = async (lang: string) => {
    setTranslating(true);
    setTranslated(null);
    setTranslateLang(lang);
    const src = aiSummary || truncateWords(item.contentSnippet, wordCount) || item.title;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, targetLanguage: lang }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setTranslated(full);
      }
    } catch {
      setTranslated(null);
      setTranslateLang(null);
    } finally {
      setTranslating(false);
    }
  };

  const reset = () => {
    setAiSummary(null);
    setSummaryLang(null);
    setTranslated(null);
    setTranslateLang(null);
  };

  return { aiSummary, summaryLang, summarizing, translating, translated, translateLang, summarize, translate, reset };
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

function FullScreenCard({ item, words }: { item: NewsItem; words: number }) {
  const ai = useArticleAI(item, words);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !autoTried.current) {
            autoTried.current = true;
            ai.summarize('English');
          }
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyText = ai.translated ?? ai.aiSummary ?? truncateWords(item.contentSnippet, words);
  const activeLang = ai.translateLang ?? ai.summaryLang;
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
          ) : (ai.translating && !ai.translated) ? (
            <p className="text-[15px] text-ink-muted leading-relaxed flex items-center gap-2">
              <AiDots /> Translating…
            </p>
          ) : bodyText ? (
            <p className="text-[15px] leading-relaxed text-ink">
              {bodyText}
            </p>
          ) : null}
        </div>

        {/* Language / translate pickers */}
        {showLangPicker && !ai.summarizing && (
          <div className="pt-3 flex flex-wrap gap-1.5">
            {SUMMARY_LANGS.map(({ code, label, flag }) => (
              <button
                key={code}
                onClick={() => { setShowLangPicker(false); ai.summarize(label); }}
                className="text-xs px-2.5 py-1 rounded-full bg-surface2 border border-hairline text-ink hover:border-accent transition-colors"
              >
                {flag} {code}
              </button>
            ))}
          </div>
        )}

        {showTranslate && (
          <div className="pt-3 flex flex-wrap gap-1.5">
            {TRANSLATE_LANGS.map(lang => (
              <button
                key={lang}
                onClick={() => { setShowTranslate(false); ai.translate(lang); }}
                className="text-xs px-2.5 py-1 rounded-full bg-surface2 border border-hairline text-ink hover:border-accent transition-colors"
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* Meta row: time · source | AI actions */}
        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-[11px] text-ink-muted truncate">
            {timeAgo(item.pubDate)} · {item.sourceName}
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => { setShowLangPicker(v => !v); setShowTranslate(false); }}
              className={`text-[11px] font-medium transition-colors ${showLangPicker ? 'text-accent' : 'text-ink-muted hover:text-accent'}`}
            >
              ✦ AI
            </button>
            <button
              onClick={() => { setShowTranslate(v => !v); setShowLangPicker(false); }}
              className={`text-[11px] transition-colors ${showTranslate ? 'text-accent' : 'text-ink-muted hover:text-accent'}`}
            >
              🌐
            </button>
            {(ai.aiSummary || ai.translated) && !ai.summarizing && (
              <button
                onClick={() => { ai.reset(); autoTried.current = true; setShowLangPicker(false); setShowTranslate(false); }}
                className="text-[11px] text-ink-muted hover:text-ink transition-colors"
              >
                ✕
              </button>
            )}
          </div>
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

export default function NewsFeed({ words = 60 }: { words?: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news?limit=15');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const visible = useMemo(
    () => items.filter(i => category === 'all' || i.category === category),
    [items, category]
  );

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
          onClick={fetchNews}
          className="ml-auto px-3.5 py-2.5 text-ink-muted hover:text-accent transition-colors flex-shrink-0 text-sm"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* ── Swipe deck ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-thin">
        {loading ? spinner : visible.length === 0 ? empty :
          visible.map((item, i) => (
            <FullScreenCard key={`${item.link}-${i}`} item={item} words={words} />
          ))}
      </div>
    </div>
  );
}
