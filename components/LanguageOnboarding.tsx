'use client';

/* First-run language picker — shown once, then accessible from the
   header. One language, set once: every AI summary is generated in
   this language automatically. No per-card pickers anywhere.       */

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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={firstRun ? undefined : onClose} />
      <div
        className="relative w-full sm:max-w-sm glass border-t sm:border border-hairline sm:rounded-2xl p-5"
        style={{ animation: 'sheetUp 0.4s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-base font-semibold text-ink">
            {firstRun ? 'Welcome to Brève' : 'Reading language'}
          </h2>
          {!firstRun && (
            <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm px-1">✕</button>
          )}
        </div>
        <p className="text-xs text-ink-muted mb-4">
          {firstRun
            ? 'What language do you want your news in? Every summary will be written in it.'
            : 'Every AI summary is written in this language.'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map(({ label, flag }) => (
            <button
              key={label}
              onClick={() => { onSelect(label); onClose(); }}
              className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-colors ${
                label === current
                  ? 'border-accent text-ink bg-surface'
                  : 'border-hairline text-ink-muted hover:text-ink hover:border-accent/50'
              }`}
            >
              <span className="text-lg">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
