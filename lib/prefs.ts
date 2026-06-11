'use client';

/* ── Client preference store ────────────────────────────────────────
   localStorage is the system of record (works signed-out, zero
   latency). Signed-in users get a debounced mirror to /api/prefs
   so preferences survive across devices.                            */

export interface Follow {
  type: 'topic' | 'entity' | 'source';
  value: string;
}

export interface Streak {
  count: number;
  lastDay: string; // local YYYY-MM-DD
}

export interface Prefs {
  edition: string;
  lang: string;
  langSet: boolean;
  follows: Follow[];
  affinity: Record<string, number>; // keys: cat:{category}, src:{source}
  readLinks: string[];              // ring buffer, newest first
  savedLinks: string[];             // explicitly saved stories
  skippedLinks: string[];           // explicitly skipped, filtered from feed
  lastVisit: number;                // epoch ms
  streak: Streak;
}

const KEY = 'breve:prefs:v1';
const MAX_READ_LINKS = 500;
const DECAY = 0.98; // EMA decay applied on every dwell signal

const DEFAULTS: Prefs = {
  edition: 'US:en',
  lang: 'English',
  langSet: false,
  follows: [],
  affinity: {},
  readLinks: [],
  savedLinks: [],
  skippedLinks: [],
  lastVisit: 0,
  streak: { count: 0, lastDay: '' },
};

let cached: Prefs | null = null;

export function getPrefs(): Prefs {
  if (cached) return cached;
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached!;
}

function persist() {
  if (!cached || typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch {}
  scheduleSync();
}

export function updatePrefs(patch: Partial<Prefs>): Prefs {
  cached = { ...getPrefs(), ...patch };
  persist();
  return cached;
}

/* ── Implicit signals ──────────────────────────────────────────── */

// Dwell on a card. ≥8s strong signal, ≥3s read, instant swipe-past slight negative.
export function recordDwell(item: { category: string; source: string }, ms: number) {
  const prefs = getPrefs();
  const delta = ms >= 8000 ? 2 : ms >= 3000 ? 1 : ms < 1200 ? -0.3 : 0;
  if (delta === 0) return;
  const aff = { ...prefs.affinity };
  for (const key of [`cat:${item.category}`, `src:${item.source}`]) {
    aff[key] = (aff[key] ?? 0) * DECAY + delta;
  }
  updatePrefs({ affinity: aff });
}

export function markRead(link: string) {
  const prefs = getPrefs();
  if (prefs.readLinks.includes(link)) return;
  updatePrefs({ readLinks: [link, ...prefs.readLinks].slice(0, MAX_READ_LINKS) });
}

/* ── Streak (local-midnight safe) ──────────────────────────────── */

function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Call once per app open. Returns the updated streak.
export function touchStreak(): Streak {
  const prefs = getPrefs();
  const today = localDay();
  const { streak } = prefs;
  if (streak.lastDay === today) return streak;

  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  const next: Streak = streak.lastDay === yesterday
    ? { count: streak.count + 1, lastDay: today }
    : { count: 1, lastDay: today };
  updatePrefs({ streak: next, lastVisit: Date.now() });
  return next;
}

/* ── Save / Skip ───────────────────────────────────────────────── */

const MAX_SAVED_LINKS = 200;
const MAX_SKIPPED_LINKS = 500;

export function toggleSave(link: string): boolean {
  const prefs = getPrefs();
  const isSavedNow = prefs.savedLinks.includes(link);
  if (isSavedNow) {
    updatePrefs({ savedLinks: prefs.savedLinks.filter(l => l !== link) });
    return false;
  }
  updatePrefs({ savedLinks: [link, ...prefs.savedLinks].slice(0, MAX_SAVED_LINKS) });
  return true;
}

export function isSaved(link: string): boolean {
  return getPrefs().savedLinks.includes(link);
}

export function skipLink(link: string): void {
  const prefs = getPrefs();
  if (prefs.skippedLinks.includes(link)) return;
  updatePrefs({ skippedLinks: [link, ...prefs.skippedLinks].slice(0, MAX_SKIPPED_LINKS) });
}

/* ── Follows ───────────────────────────────────────────────────── */

export function toggleFollow(follow: Follow): Prefs {
  const prefs = getPrefs();
  const exists = prefs.follows.some(f => f.type === follow.type && f.value === follow.value);
  const follows = exists
    ? prefs.follows.filter(f => !(f.type === follow.type && f.value === follow.value))
    : [...prefs.follows, follow];
  return updatePrefs({ follows });
}

export function isFollowing(follow: Follow): boolean {
  return getPrefs().follows.some(f => f.type === follow.type && f.value === follow.value);
}

/* ── Server mirror (signed-in users only; 204 = not signed in) ─── */

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const p = getPrefs();
    try {
      await fetch('/api/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edition: p.edition, lang: p.lang,
          follows: p.follows, affinity: p.affinity, streak: p.streak,
        }),
      });
    } catch {}
  }, 4000);
}

// Pull server prefs on sign-in and merge (server wins for follows/lang/edition,
// local wins for affinity which is richer on-device).
export async function pullServerPrefs(): Promise<void> {
  try {
    const res = await fetch('/api/prefs');
    if (res.status !== 200) return;
    const server = await res.json();
    const local = getPrefs();
    updatePrefs({
      edition: server.edition ?? local.edition,
      lang: server.lang ?? local.lang,
      langSet: local.langSet || !!server.lang,
      follows: server.follows?.length ? server.follows : local.follows,
      streak: (server.streak?.count ?? 0) > local.streak.count ? server.streak : local.streak,
    });
  } catch {}
}
