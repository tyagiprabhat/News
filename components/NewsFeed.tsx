'use client';

import { useState, useEffect, useCallback } from 'react';
import { NEWS_SOURCES } from '@/lib/news';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
  sourceName: string;
  sourceFlag: string;
}

type SourceFilter = 'all' | string;

const SOURCE_COLORS: Record<string, string> = {
  ap:        'text-blue-400 bg-blue-950/50 border-blue-800/50',
  reuters:   'text-orange-400 bg-orange-950/50 border-orange-800/50',
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

const TRANSLATE_LANGS = ['French', 'German', 'Spanish', 'Arabic', 'Portuguese', 'Italian', 'English'];

function truncate60(text?: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= 60) return text;
  return words.slice(0, 60).join(' ') + '…';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ArticleCard({ item }: { item: NewsItem }) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translateLang, setTranslateLang] = useState<string | null>(null);

  const colorClass = SOURCE_COLORS[item.source] ?? 'text-gray-400 bg-gray-800/40 border-gray-700/40';

  const summarize = async () => {
    setSummarizing(true);
    setAiSummary('');
    setTranslated(null);
    setTranslateLang(null);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, snippet: item.contentSnippet, source: item.sourceName }),
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
    } finally {
      setSummarizing(false);
    }
  };

  const translate = async (lang: string) => {
    setShowTranslate(false);
    setTranslating(true);
    setTranslated(null);
    setTranslateLang(lang);
    const src = aiSummary || truncate60(item.contentSnippet) || item.title;
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

  const bodyText = translated ?? aiSummary ?? truncate60(item.contentSnippet);

  return (
    <div className="mx-3 my-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden">
      {/* Source chip + timestamp */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
          {item.sourceFlag} {item.sourceName}
        </span>
        <span className="text-xs text-gray-600">{timeAgo(item.pubDate)}</span>
      </div>

      {/* Headline */}
      <h3 className="px-4 text-sm font-bold text-white leading-snug line-clamp-3">
        {item.title}
      </h3>

      {/* Body — 60-word summary */}
      <div className="px-4 pt-2 min-h-[3rem]">
        {summarizing && !aiSummary ? (
          <span className="flex items-center gap-1.5 text-xs text-purple-400">
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
            Generating summary…
          </span>
        ) : translating && !translated ? (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
            Translating…
          </span>
        ) : bodyText ? (
          <p className={`text-xs leading-relaxed ${
            translated ? 'text-blue-200' : aiSummary ? 'text-gray-200' : 'text-gray-400'
          }`}>
            {bodyText}
          </p>
        ) : null}

        {translateLang && translated && (
          <span className="inline-block mt-1 text-xs text-blue-500">🌐 {translateLang}</span>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between px-4 py-2.5 mt-2 border-t border-gray-800">
        <div className="flex items-center gap-3 relative">
          {!aiSummary && !summarizing && (
            <button
              onClick={summarize}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              ✨ AI summary
            </button>
          )}
          {(aiSummary || translated) && !summarizing && (
            <button
              onClick={() => { setAiSummary(null); setTranslated(null); setTranslateLang(null); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              × Reset
            </button>
          )}

          <button
            onClick={() => setShowTranslate(v => !v)}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            🌐
          </button>

          {showTranslate && (
            <div className="absolute left-0 bottom-7 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 flex flex-wrap gap-1 w-48">
              {TRANSLATE_LANGS.map(lang => (
                <button
                  key={lang}
                  onClick={() => translate(lang)}
                  className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-blue-700 text-gray-300 hover:text-white transition-colors"
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          Full story →
        </a>
      </div>
    </div>
  );
}

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === 'all' ? '?limit=8' : `?source=${filter}&limit=8`;
      const res = await fetch(`/api/news${qs}`);
      const data = await res.json();
      setItems(data.items || []);
      setLastFetched(data.fetchedAt);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Live Feed</h2>
        <button onClick={fetchNews} className="text-xs text-gray-500 hover:text-blue-400 transition-colors" title="Refresh">
          ↻ Refresh
        </button>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-gray-800 overflow-x-auto scrollbar-thin flex-nowrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🌐 All
        </button>
        {Object.entries(NEWS_SOURCES).map(([key, src]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {src.flag} {src.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 text-sm p-8">No articles found</p>
        ) : (
          items.map((item, i) => <ArticleCard key={i} item={item} />)
        )}
      </div>

      {lastFetched && (
        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
          Updated {timeAgo(lastFetched)}
        </div>
      )}
    </div>
  );
}
