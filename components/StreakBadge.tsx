'use client';

import { useEffect, useState } from 'react';
import { getPrefs, touchStreak } from '@/lib/prefs';

/* Header flame: consecutive days reading Brève.
   Milestones at 3/7/30 get a hairline gold pulse — quiet, not confetti. */

const MILESTONES = [3, 7, 30, 100];

export default function StreakBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const streak = touchStreak();
    setCount(streak.count);
  }, []);

  if (count < 2) return null;

  const milestone = MILESTONES.includes(count);

  return (
    <span
      className={`flex items-center gap-1 text-xs border rounded-full px-2.5 py-1 select-none ${
        milestone
          ? 'border-accent text-accent animate-pulse'
          : 'border-hairline text-ink-muted'
      }`}
      title={`${count}-day streak${milestone ? ' — milestone!' : ''}`}
    >
      <span>🔥</span>
      <span className="tabular-nums font-medium">{count}</span>
    </span>
  );
}

export function getStreakCount(): number {
  return getPrefs().streak.count;
}
