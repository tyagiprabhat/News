'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { NEWS_SOURCES, CATEGORIES } from '@/lib/news';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  imageUrl?: string;
  category: string;
  source: string;
  sourceName: string;
  sourceFlag: string;
}

const SOURCE_COLORS: Record<string, string> = {
  ap:        'text-blue-400 bg-blue-950/50 border-blue-800/50',
  guardian:  'text-orange-400 bg-orange-950/50 border-orange-800/50',
  bbc:       'text-red-400 bg-red-950/50 border-red-800/50',
  npr:       'text-indigo-400 bg-indigo-950/50 border-indigo-800/50',
  aljazeera: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50',
  france24:  'text-blue-300 bg-blue-950/40 border-blue-700/40',
  rfi:       'text-purple-400 bg-purple-950/50 border-purple-800/50',
  euronews:  'text-cyan-400 bg-cyan-950/50 border-cyan-800/50',
  politico:  'text-sky-400 bg-sky-950/50 border-sky-800/50',
  dw:        'text-teal-400 bg-teal-950/50 border-teal-800/50',
  hindu:     'text-rose-400 bg-rose-950/50 border-rose-800/50',
  toi:       'text-amber-400 bg-amber-950/50 border-amber-800/50',
  economist: 'text-red-300 bg-red-950/40 border-red-700/40',
};

const SOURCE_GRADIENTS: Record<string, string> = {
  ap:        'from-blue-900 to-gray-950',
  guardian:  'from-orange-900 to-gray-950',
  bbc:       'from-red-900 to-gray-950',
  npr:       'from-indigo-900 to-gray-950',
  aljazeera: 'from-emerald-900 to-gray-950',
  france24:  'from-blue-800 to-gray-950',
  rfi:       'from-purple-900 to-gray-950',
  euronews:  'from-cyan-900 to-gray-950',
  politico:  'from-sky-900 to-gray-950',
  dw:        'from-teal-900 to-gray-950',
  hindu:     'from-rose-900 to-gray-950',
  toi:       'from-amber-900 to-gray-950',
  economist: 'from-red-800 to-gray-950',
};

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.key, `${c.emoji} ${c.label}`])
);

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

function AiSpinner({ color, label }: { color: string; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${color}`}>
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
      {label}
    </span>
  );
}

/* ── Full-screen InShorts-style card (mobile + desktop) ────────── */

function FullScreenCard({ item, words }: { item: NewsItem; words: number }) {
  const ai = useArticleAI(item, words);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const colorClass = SOURCE_COLORS[item.source] ?? 'text-gray-400 bg-gray-800/40 border-gray-700/40';
  const gradient = SOURCE_GRADIENTS[item.source] ?? 'from-gray-800 to-gray-950';
  const bodyText = ai.translated ?? ai.aiSummary ?? truncateWords(item.contentSnippet, words);
  const activeLang = ai.translateLang ?? ai.summaryLang;

  return (
    <div className="snap-start h-full flex flex-col bg-gray-950 overflow-hidden">
      {/* Hero image */}
      <div className="relative h-[38%] flex-shrink-0 bg-gray-900">
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
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-7xl opacity-60">{item.sourceFlag}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-gray-950 to-transparent" />
        <span className={`absolute bottom-3 left-4 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur ${colorClass}`}>
          {item.sourceFlag} {item.sourceName}
        </span>
        <span className="absolute top-3 left-4 text-xs text-gray-200 bg-gray-950/60 backdrop-blur px-2.5 py-1 rounded-full">
          {CATEGORY_LABELS[item.category] ?? item.category}
        </span>
        {activeLang && activeLang !== 'English' && (
          <span className="absolute bottom-3 right-4 text-xs text-blue-300 bg-gray-950/70 backdrop-blur px-2 py-1 rounded-full">
            🌐 {activeLang}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col px-5 pt-3 overflow-y-auto scrollbar-thin">
        <h2 className="text-xl font-bold text-white leading-snug">
          {item.title}
        </h2>

        <div className="mt-3 flex-1">
          {(ai.summarizing && !ai.aiSummary) ? (
            <AiSpinner color="text-purple-400" label={`Writing ${ai.summaryLang !== 'English' ? `in ${ai.summaryLang}` : 'summary'}…`} />
          ) : (ai.translating && !ai.translated) ? (
            <AiSpinner color="text-blue-400" label="Translating…" />
          ) : bodyText ? (
            <p className={`text-[15px] leading-relaxed ${
              ai.translated ? 'text-blue-200' : ai.aiSummary ? 'text-gray-100' : 'text-gray-300'
            }`}>
              {bodyText}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">Tap ✨ for an AI summary of this story.</p>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {timeAgo(item.pubDate)} <span className="text-gray-700 mx-1">|</span> {item.sourceName}
        </p>

        {showLangPicker && !ai.aiSummary && !ai.summarizing && (
          <div className="pt-2 flex flex-wrap gap-1.5">
            {SUMMARY_LANGS.map(({ code, label, flag }) => (
              <button
                key={code}
                onClick={() => { setShowLangPicker(false); ai.summarize(label); }}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-800 hover:bg-purple-800 active:bg-purple-800 border border-gray-700 text-gray-300 transition-all"
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
                className="text-xs px-2.5 py-1 rounded-full bg-gray-800 hover:bg-blue-700 active:bg-blue-700 border border-gray-700 text-gray-300 transition-colors"
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-5 py-3">
          {!ai.aiSummary && !ai.summarizing ? (
            <button
              onClick={() => { setShowLangPicker(v => !v); setShowTranslate(false); }}
              className={`text-sm font-medium ${showLangPicker ? 'text-purple-300' : 'text-purple-400 hover:text-purple-300'}`}
            >
              ✨ AI Summary
            </button>
          ) : !ai.summarizing && (
            <button onClick={() => { ai.reset(); setShowLangPicker(false); setShowTranslate(false); }} className="text-sm text-gray-500 hover:text-gray-300">
              × Reset
            </button>
          )}
          <button
            onClick={() => { setShowTranslate(v => !v); setShowLangPicker(false); }}
            className={`text-sm ${showTranslate ? 'text-blue-300' : 'text-gray-400 hover:text-blue-300'}`}
          >
            🌐 Translate
          </button>
        </div>
      </div>

      {/* Bottom "read more" strip */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 mx-4 mb-3 flex items-center justify-between rounded-xl bg-gray-900 border border-gray-800 hover:bg-gray-800 active:bg-gray-800 px-4 py-3 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-200 truncate pr-3">Tap to read full story</span>
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm">›</span>
      </a>
    </div>
  );
}

/* ── Feed container ────────────────────────────────────────────── */

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const qs = sourceFilter === 'all' ? '?limit=10' : `?source=${sourceFilter}&limit=10`;
      const res = await fetch(`/api/news${qs}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const visible = useMemo(
    () => category === 'all' ? items : items.filter(i => i.category === category),
    [items, category]
  );

  const spinner = (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs — primary, InShorts style */}
      <div className="flex gap-1 px-3 pt-2 pb-1.5 overflow-x-auto scrollbar-thin flex-nowrap flex-shrink-0">
        {CATEGORIES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              category === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Source filter — secondary row */}
      <div className="flex items-center gap-1 px-3 pb-2 border-b border-gray-800 overflow-x-auto scrollbar-thin flex-nowrap flex-shrink-0">
        <button
          onClick={() => setSourceFilter('all')}
          className={`text-[11px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
            sourceFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 border border-gray-800'
          }`}
        >
          All sources
        </button>
        {Object.entries(NEWS_SOURCES).map(([key, src]) => (
          <button
            key={key}
            onClick={() => setSourceFilter(key)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              sourceFilter === key ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            {src.flag} {src.name}
          </button>
        ))}
        <button onClick={fetchNews} className="ml-auto text-[11px] text-gray-600 hover:text-blue-400 transition-colors flex-shrink-0 pl-2" title="Refresh">
          ↻
        </button>
      </div>

      {/* Swipeable card deck — mobile gets 60-word summaries, desktop 90 */}
      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-contain">
        {loading ? spinner : visible.length === 0 ? (
          <p className="text-center text-gray-500 text-sm p-8">No articles in this category right now</p>
        ) : (
          visible.map((item, i) => <FullScreenCard key={`${item.link}-${i}`} item={item} words={60} />)
        )}
      </div>

      <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-contain">
        {loading ? spinner : visible.length === 0 ? (
          <p className="text-center text-gray-500 text-sm p-8">No articles in this category right now</p>
        ) : (
          visible.map((item, i) => <FullScreenCard key={`${item.link}-${i}`} item={item} words={90} />)
        )}
      </div>
    </div>
  );
}
