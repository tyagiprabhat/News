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

const SOURCE_KEYS = ['all', ...Object.keys(NEWS_SOURCES)] as const;
type SourceFilter = typeof SOURCE_KEYS[number];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const source = filter === 'all' ? '' : `?source=${filter}`;
      const res = await fetch(`/api/news${source}&limit=8`);
      const data = await res.json();
      setItems(data.items || []);
      setLastFetched(data.fetchedAt);
    } catch {
      // silently fail — news feed is supplementary
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

      <div className="flex gap-1 px-3 py-2 flex-wrap border-b border-gray-800">
        {SOURCE_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {key === 'all' ? '🌐 All' : `${NEWS_SOURCES[key]?.flag} ${NEWS_SOURCES[key]?.name}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 text-sm p-8">No articles found</p>
        ) : (
          <ul className="divide-y divide-gray-800/50">
            {items.map((item, i) => (
              <li key={i} className="px-4 py-3 hover:bg-gray-900/50 transition-colors group">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {item.sourceFlag} {item.sourceName}
                    </span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-600">{timeAgo(item.pubDate)}</span>
                  </div>
                  <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2 transition-colors">
                    {item.title}
                  </p>
                  {item.contentSnippet && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.contentSnippet}
                    </p>
                  )}
                </a>
              </li>
            ))}
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
