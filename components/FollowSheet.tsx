'use client';

import { useState } from 'react';
import { CATEGORIES } from '@/lib/news';
import { getPrefs, toggleFollow, type Follow } from '@/lib/prefs';

/* Manage follows: topic chips + free-text entity follows.
   Entity follows are fed by /api/discover (Google News search). */

export default function FollowSheet({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [follows, setFollows] = useState<Follow[]>(() => getPrefs().follows);
  const [entity, setEntity] = useState('');

  const handleToggle = (f: Follow) => {
    const next = toggleFollow(f);
    setFollows(next.follows);
    onChange();
  };

  const addEntity = () => {
    const value = entity.trim();
    if (value.length < 2) return;
    handleToggle({ type: 'entity', value });
    setEntity('');
  };

  const followingTopic = (key: string) => follows.some(f => f.type === 'topic' && f.value === key);
  const entityFollows = follows.filter(f => f.type === 'entity');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm glass border-t sm:border border-hairline sm:rounded-2xl p-5 max-h-[80%] overflow-y-auto scrollbar-thin"
        style={{ animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-base font-semibold text-ink">Your follows</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm px-1">✕</button>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          Followed topics and names rise to the top of My Feed.
        </p>

        {/* Topics */}
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-2">Topics</p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORIES.filter(c => c.key !== 'all').map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => handleToggle({ type: 'topic', value: key })}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                followingTopic(key)
                  ? 'border-accent text-ink bg-surface'
                  : 'border-hairline text-ink-muted hover:text-ink hover:border-accent/50'
              }`}
            >
              {emoji} {label}{followingTopic(key) ? ' ✓' : ''}
            </button>
          ))}
        </div>

        {/* Entities */}
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-2">
          People, places & things
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={entity}
            onChange={e => setEntity(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addEntity(); }}
            placeholder="e.g. SpaceX, Taylor Swift, Nigeria…"
            className="flex-1 bg-surface border border-hairline rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={addEntity}
            disabled={entity.trim().length < 2}
            className="bg-accent text-accent-ink rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-accent-hover transition-colors"
          >
            Follow
          </button>
        </div>
        {entityFollows.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entityFollows.map(f => (
              <button
                key={f.value}
                onClick={() => handleToggle(f)}
                className="text-xs px-2.5 py-1.5 rounded-full border border-accent text-ink bg-surface hover:border-breaking hover:text-breaking transition-colors"
                title="Unfollow"
              >
                {f.value} ✕
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
