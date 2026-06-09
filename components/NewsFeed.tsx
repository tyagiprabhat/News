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

type SourceFilter = 'all' | keyof typeof NEWS_SOURCES;

const TRANSLATE_LANGS = ['French', 'German', 'Spanish', 'Arabic', 'Portuguese', 'Italian', 'English'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ArticleCard({ item }: { item: NewsItem }) {
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<{ title: string; snippet: string; lang: string } | null>(null);

  const translate = async (lang: string) => {
    setShowLangPicker(false);
    setTranslating(true);
    setTranslated(null);

    const textToTranslate = [item.title, item.contentSnippet].filter(Boolean).join('\n\n');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, targetLanguage: lang }),
      });
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
      }

      const lines = full.trim().split('\n\n');
      const title = lines[0] || item.title;
      const snippet = lines.slice(1).join(' ').trim() || undefined;
      setTranslated({ title, snippet: snippet || '', lang });
    } catch {
      // silently revert
    } finally {
      setTranslating(false);
    }
  };

  const displayTitle = translated ? translated.title : item.title;
  const displaySnippet = translated ? translated.snippet : item.contentSnippet;

  return (
    <li className="px-4 py-3 hover:bg-gray-900/50 transition-colors group relative">
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500">
            {item.sourceFlag} {item.sourceName}
          </span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-600">{timeAgo(item.pubDate)}</span>
          {translated && (
            <>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-blue-500">🌐 {translated.lang}</span>
            </>
          )}
        </div>
        <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2 transition-colors">
          {displayTitle}
        </p>
        {displaySnippet && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {displaySnippet}
          </p>
        )}
      </a>

      {/* Translate controls */}
      <div className="mt-1.5 flex items-center gap-1.5 relative">
        {translating ? (
          <span className="text-xs text-blue-400 flex items-center gap-1">
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            Translating…
          </span>
        ) : (
          <>
            <button
              onClick={e => { e.preventDefault(); setShowLangPicker(v => !v); setTranslated(null); }}
              className="text-xs text-gray-600 hover:text-blue-400 transition-colors"
              title="Translate article"
            >
              🌐 Translate
            </button>
            {translated && (
              <button
                onClick={e => { e.preventDefault(); setTranslated(null); }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                × Original
              </button>
            )}
          </>
        )}

        {showLangPicker && (
          <div className="absolute left-0 top-5 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 flex flex-wrap gap-1 w-52">
            {TRANSLATE_LANGS.map(lang => (
              <button
                key={lang}
                onClick={e => { e.preventDefault(); translate(lang); }}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-blue-700 text-gray-300 hover:text-white transition-colors"
              >
                {lang}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
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
        <button
          onClick={fetchNews}
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Horizontally scrollable source tabs */}
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
            onClick={() => setFilter(key as SourceFilter)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {src.flag} {src.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
          <ul className="divide-y divide-gray-800/50">
            {items.map((item, i) => <ArticleCard key={i} item={item} />)}
          </ul>
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
