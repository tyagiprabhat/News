'use client';

import { useState } from 'react';

export const LANGUAGES = [
  { label: 'English',    flag: '🇺🇸' },
  { label: 'French',     flag: '🇫🇷' },
  { label: 'German',     flag: '🇩🇪' },
  { label: 'Spanish',    flag: '🇪🇸' },
  { label: 'Portuguese', flag: '🇧🇷' },
  { label: 'Arabic',     flag: '🇸🇦' },
  { label: 'Hindi',      flag: '🇮🇳' },
  { label: 'Italian',    flag: '🇮🇹' },
  { label: 'Japanese',   flag: '🇯🇵' },
  { label: 'Chinese',    flag: '🇨🇳' },
  { label: 'Korean',     flag: '🇰🇷' },
  { label: 'Dutch',      flag: '🇳🇱' },
];

export default function LanguageOnboarding({
  current,
  firstRun,
  onSelect,
  onClose,
}: {
  current: string;
  firstRun: boolean;
  onSelect: (lang: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(current);
  const currentLang = LANGUAGES.find(l => l.label === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={firstRun ? undefined : onClose} />
      <div
        className="relative w-full sm:max-w-sm glass border-t sm:border border-hairline sm:rounded-2xl p-6"
        style={{ animation: 'sheetUp 0.4s cubic-bezier(0.32,0.72,0,1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-base font-semibold text-ink">
            {firstRun ? 'Welcome to Brève' : 'Reading language'}
          </h2>
          {!firstRun && (
            <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm px-1">✕</button>
          )}
        </div>
        <p className="text-xs text-ink-muted mb-5">
          {firstRun
            ? 'Every summary will be written in your language. You can always read in English from the feed.'
            : 'Every AI summary is written in this language.'}
        </p>

        {/* Language selector */}
        <div className="relative mb-5">
          {/* Flag preview overlay — left side of the input */}
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg pointer-events-none z-10">
            {currentLang?.flag ?? '🌐'}
          </span>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full appearance-none bg-surface border border-hairline focus:border-accent rounded-xl pl-11 pr-10 py-3.5 text-ink text-sm outline-none transition-colors cursor-pointer"
          >
            {LANGUAGES.map(({ label, flag }) => (
              <option key={label} value={label}>
                {flag}  {label}
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted text-xs pointer-events-none">
            ▾
          </span>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => { onSelect(selected); onClose(); }}
          className="w-full bg-accent text-accent-ink font-semibold text-sm py-3 rounded-xl hover:bg-accent-hover transition-colors ease-spring"
        >
          {selected === 'English' ? 'Continue in English' : `Continue in ${selected}`}
        </button>

        {firstRun && selected !== 'English' && (
          <p className="text-center text-[11px] text-ink-muted mt-3">
            You can switch to English any time from the feed
          </p>
        )}
      </div>
    </div>
  );
}
