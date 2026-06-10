'use client';

import { useState } from 'react';

/* ── Coverage transparency — the trust hook Inshorts lacks ──────────
   "12 outlets · 6 countries" under the headline; tapping expands a
   sheet listing who is covering the story, grouped by outlet type
   and country. Pure data from the Scout's cluster_coverage rows.   */

interface CoverageDetail {
  outletCount: number;
  countryCount: number;
  byType: Record<string, { name: string; title: string; url: string }[]>;
  byCountry: Record<string, { publisher: string; title: string; url: string }[]>;
}

export default function CoverageBar({
  storyId,
  clusterSize,
  countries,
}: {
  storyId: string;
  clusterSize: number;
  countries: number;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CoverageDetail | null>(null);
  const [loading, setLoading] = useState(false);

  if (clusterSize < 2) return null;

  const openSheet = async () => {
    setOpen(true);
    if (detail || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/story/${storyId}`);
      if (res.ok) setDetail(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={openSheet}
        className="flex items-center gap-1.5 text-[11px] text-ink-muted hover:text-accent transition-colors"
        title="Who's covering this story"
      >
        <span className="flex gap-0.5">
          {Array.from({ length: Math.min(clusterSize, 5) }).map((_, i) => (
            <span key={i} className="w-1 h-3 bg-accent/70 rounded-sm" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </span>
        <span>
          {clusterSize} outlet{clusterSize === 1 ? '' : 's'}
          {countries > 1 ? ` · ${countries} countries` : ''}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div
            className="relative w-full sm:max-w-sm glass border-t sm:border border-hairline sm:rounded-2xl p-5 max-h-[70%] overflow-y-auto scrollbar-thin"
            style={{ animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-ink">Coverage</h2>
              <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink text-sm px-1">✕</button>
            </div>

            {loading && <p className="text-xs text-ink-muted">Checking the wires…</p>}

            {detail && (
              <div className="space-y-4">
                <p className="text-xs text-ink-muted">
                  {detail.outletCount} outlets across {Math.max(detail.countryCount, 1)} {detail.countryCount === 1 ? 'region' : 'regions'} are covering this story.
                </p>
                {Object.entries(detail.byType).map(([type, outlets]) => (
                  <div key={type}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-accent mb-1.5">{type}</p>
                    {outlets.map(o => (
                      <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer"
                         className="block text-[12px] text-ink hover:text-accent transition-colors py-0.5 truncate">
                        {o.name} — {o.title}
                      </a>
                    ))}
                  </div>
                ))}
                {Object.entries(detail.byCountry).map(([country, items]) => (
                  <div key={country}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-1.5">
                      {country === 'global' ? 'International' : country}
                    </p>
                    {items.slice(0, 4).map(c => (
                      <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer"
                         className="block text-[12px] text-ink hover:text-accent transition-colors py-0.5 truncate">
                        {c.publisher} — {c.title}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!loading && !detail && (
              <p className="text-xs text-ink-muted">Coverage details aren&apos;t available for this story.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
