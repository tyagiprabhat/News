/* ── Client-side feed ranking ───────────────────────────────────────
   Pure functions — no I/O, no LLM. The feed API stays a dumb cached
   pipe; personalization happens on device from prefs signals.       */

import type { Follow } from '@/lib/prefs';

interface RankableItem {
  title: string;
  link: string;
  pubDate: string;
  category: string;
  source: string;
  contentSnippet?: string;
  _clusterSize?: number;
}

export interface RankSignals {
  affinity: Record<string, number>;
  follows: Follow[];
  readLinks: string[];
  skippedLinks?: string[];
}

function recencyDecay(pubDate: string): number {
  const hours = Math.max(0, (Date.now() - new Date(pubDate).getTime()) / 3_600_000);
  return Math.exp(-hours / 24); // half-life ≈ 17h
}

// Squash unbounded affinity scores into 0..1
function squash(x: number): number {
  return x / (1 + Math.abs(x));
}

export function scoreItem(item: RankableItem, signals: RankSignals): number {
  const catAff = squash(signals.affinity[`cat:${item.category}`] ?? 0);
  const srcAff = squash(signals.affinity[`src:${item.source}`] ?? 0);

  const text = `${item.title} ${item.contentSnippet ?? ''}`.toLowerCase();
  const followHit = signals.follows.some(f =>
    f.type === 'topic'
      ? item.category === f.value
      : text.includes(f.value.toLowerCase())
  ) ? 1 : 0;

  const clusterBonus = 1 + Math.min(item._clusterSize ?? 0, 5) * 0.08;
  const readPenalty = signals.readLinks.includes(item.link) ? 0.2 : 1;

  return recencyDecay(item.pubDate)
    * (1 + catAff + srcAff + followHit * 2)
    * clusterBonus
    * readPenalty;
}

/* Rank with a diversity guard: never 3 consecutive cards of the same
   category — preserves the variable-reward feel of the swipe deck.  */
export function rankFeed<T extends RankableItem>(items: T[], signals: RankSignals): T[] {
  const skipped = new Set(signals.skippedLinks ?? []);
  const scored = items
    .filter(item => !skipped.has(item.link))
    .map(item => ({ item, score: scoreItem(item, signals) }))
    .sort((a, b) => b.score - a.score);

  const result: T[] = [];
  const pool = [...scored];
  while (pool.length > 0) {
    const lastTwo = result.slice(-2).map(i => i.category);
    const sameStreak = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];
    let pick = 0;
    if (sameStreak) {
      const alt = pool.findIndex(p => p.item.category !== lastTwo[0]);
      if (alt >= 0) pick = alt;
    }
    result.push(pool.splice(pick, 1)[0].item);
  }
  return result;
}
