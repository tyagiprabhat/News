'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CATEGORIES, REGIONS } from '@/lib/news';

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
        body: JSON.stringify({ title: item.title, snippet: item.contentSnippet, source: item.sourceName, targetLanguage: lang, wordCount }),
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

function AiSpinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-accent">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
      {label}
    </span>
  );
}

/* ── Full-screen editorial card ────────────────────────────────── */

function FullScreenCard({ item, index, words }: { item: NewsItem; index: number; words: number }) {
  const ai = useArticleAI(item, words);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const bodyText = ai.translated ?? ai.aiSummary ?? truncateWords(item.contentSnippet, words);
  const activeLang = ai.translateLang ?? ai.summaryLang;
  const isBreaking = item.category === 'conflict';

  return (
    <article className="snap-start h-full flex flex-col bg-canvas overflow-hidden">
      {/* Hero image */}
      <div className="relative h-[38%] flex-shrink-0 bg-surface2">
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
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-7xl opacity-40">{item.sourceFlag}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-canvas to-transparent" />
        {/* Category kicker */}
        <span className={`absolute top-3 left-4 text-[10px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1 ${
          isBreaking ? 'bg-breaking text-white' : 'bg-canvas/70 backdrop-blur text-accent'
        }`}>
          {isBreaking ? 'Breaking' : (CATEGORY_LABELS[item.category] ?? item.category)}
        </span>
        {/* Source line */}
        <span className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink">
          <span>{item.sourceFlag}</span>{item.sourceName}
        </span>
        {activeLang && activeLang !== 'English' && (
          <span className="absolute bottom-3 right-4 text-xs text-accent bg-canvas/70 backdrop-blur px-2 py-1 rounded-full">
            🌐 {activeLang}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col px-5 pt-3 overflow-y-auto scrollbar-thin">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-semibold text-accent leading-none">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="font-display text-[22px] font-semibold text-ink leading-tight">
            {item.title}
          </h2>
        </div>

        <div className="mt-3 flex-1">
          {(ai.summarizing && !ai.aiSummary) ? (
            <AiSpinner label={`Writing ${ai.summaryLang !== 'English' ? `in ${ai.summaryLang}` : 'summary'}…`} />
          ) : (ai.translating && !ai.translated) ? (
            <AiSpinner label="Translating…" />
          ) : bodyText ? (
            <p className={`text-[15px] leading-relaxed ${ai.aiSummary || ai.translated ? 'text-ink' : 'text-ink-muted'}`}>
              {bodyText}
            </p>
          ) : (
            <p className="text-sm text-ink-muted italic">Tap ✦ for an AI summary of this story.</p>
          )}
        </div>

        <div className="rule-accent w-full mt-3" />
        <p className="mt-2 text-xs text-ink-muted uppercase tracking-wider">
          {timeAgo(item.pubDate)} · {item.sourceName}
        </p>

        {showLangPicker && !ai.aiSummary && !ai.summarizing && (
          <div className="pt-2 flex flex-wrap gap-1.5">
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
          <div className="pt-2 flex flex-wrap gap-1.5">
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

        <div className="flex items-center gap-5 py-3">
          {!ai.aiSummary && !ai.summarizing ? (
            <button
              onClick={() => { setShowLangPicker(v => !v); setShowTranslate(false); }}
              className={`text-sm font-medium ${showLangPicker ? 'text-accent' : 'text-accent/90 hover:text-accent'}`}
            >
              ✦ Summary
            </button>
          ) : !ai.summarizing && (
            <button onClick={() => { ai.reset(); setShowLangPicker(false); setShowTranslate(false); }} className="text-sm text-ink-muted hover:text-ink">
              × Reset
            </button>
          )}
          <button
            onClick={() => { setShowTranslate(v => !v); setShowLangPicker(false); }}
            className={`text-sm ${showTranslate ? 'text-accent' : 'text-ink-muted hover:text-accent'}`}
          >
            🌐 Translate
          </button>
        </div>
      </div>

      {/* Read full story */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 mx-4 mb-3 flex items-center justify-between border border-hairline hover:border-accent px-4 py-3 transition-colors group"
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-ink truncate pr-3">Read full story</span>
        <span className="flex-shrink-0 text-accent text-lg group-hover:translate-x-0.5 transition-transform">→</span>
      </a>
    </article>
  );
}

/* ── Feed container ────────────────────────────────────────────── */

export default function NewsFeed({ words = 60 }: { words?: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<string>('all');
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
    () => items.filter(i =>
      (category === 'all' || i.category === category) &&
      (region === 'all' || i.region === region)
    ),
    [items, category, region]
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

  const empty = <p className="text-center text-ink-muted text-sm p-8">No articles in this view right now</p>;

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Category tabs */}
      <div className="flex gap-1 px-3 pt-2.5 pb-1.5 overflow-x-auto scrollbar-thin flex-nowrap flex-shrink-0">
        {CATEGORIES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`text-xs font-medium uppercase tracking-wide px-2.5 py-1 whitespace-nowrap flex-shrink-0 transition-colors border-b-2 ${
              category === key ? 'text-ink border-accent' : 'text-ink-muted border-transparent hover:text-ink'
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Region filter */}
      <div className="flex items-center gap-1 px-3 pb-2 border-b border-hairline overflow-x-auto scrollbar-thin flex-nowrap flex-shrink-0">
        {REGIONS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setRegion(key)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              region === key ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink-muted hover:text-ink'
            }`}
          >
            {emoji} {label}
          </button>
        ))}
        <button onClick={fetchNews} className="ml-auto text-[11px] text-ink-muted hover:text-accent transition-colors flex-shrink-0 pl-2" title="Refresh">
          ↻
        </button>
      </div>

      {/* InShorts-style full-screen swipe deck */}
      <div className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-thin">
        {loading ? spinner : visible.length === 0 ? empty :
          visible.map((item, i) => <FullScreenCard key={`${item.link}-${i}`} item={item} index={i} words={words} />)}
      </div>
    </div>
  );
}
