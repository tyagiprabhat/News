'use client';

/* First-run gesture tutorial — shown once, never again after dismiss. */

interface GestureHint {
  icon: string;
  arrow: string;
  arrowAnim: string;
  title: string;
  desc: string;
}

const HINTS: GestureHint[] = [
  {
    icon: '📰',
    arrow: '↕',
    arrowAnim: 'bounce-v',
    title: 'Browse stories',
    desc: 'Swipe up or down to move between cards',
  },
  {
    icon: '✦',
    arrow: '→',
    arrowAnim: 'slide-right',
    title: 'Save for later',
    desc: 'Swipe right to bookmark a story',
  },
  {
    icon: '✕',
    arrow: '←',
    arrowAnim: 'slide-left',
    title: 'Skip story',
    desc: 'Swipe left to remove it from your feed',
  },
  {
    icon: '🔭',
    arrow: '✦',
    arrowAnim: 'pulse-spark',
    title: 'AI Newsroom',
    desc: 'Tap ✦ Newsroom for live multi-source analysis',
  },
];

export default function TutorialOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <style>{`
        @keyframes bounce-v {
          0%, 100% { transform: translateY(0); opacity: 1; }
          40%       { transform: translateY(-6px); opacity: 0.7; }
          60%       { transform: translateY(6px); opacity: 0.7; }
        }
        @keyframes slide-right {
          0%    { transform: translateX(-6px); opacity: 0.4; }
          60%   { transform: translateX(6px); opacity: 1; }
          100%  { transform: translateX(8px); opacity: 0; }
        }
        @keyframes slide-left {
          0%    { transform: translateX(6px); opacity: 0.4; }
          60%   { transform: translateX(-6px); opacity: 1; }
          100%  { transform: translateX(-8px); opacity: 0; }
        }
        @keyframes pulse-spark {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%      { transform: scale(1.35); opacity: 1; }
        }
        .hint-arrow { animation-duration: 1.6s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
        .bounce-v   { animation-name: bounce-v; }
        .slide-right{ animation-name: slide-right; }
        .slide-left { animation-name: slide-left; }
        .pulse-spark{ animation-name: pulse-spark; }
      `}</style>

      <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />

        {/* Sheet */}
        <div
          className="relative w-full sm:max-w-md glass border-t sm:border border-hairline sm:rounded-2xl px-5 pt-6 pb-8"
          style={{ animation: 'sheetUp 0.4s cubic-bezier(0.32,0.72,0,1)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <span className="font-display text-base font-semibold text-ink">How Brève works</span>
              <span className="rule-accent block w-10 mt-0.5" />
            </div>
            <button onClick={onDismiss} className="text-ink-muted hover:text-ink text-sm px-1 mt-0.5">✕</button>
          </div>
          <p className="text-xs text-ink-muted mb-5">Four gestures, all the world&apos;s news.</p>

          {/* Gesture grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {HINTS.map(({ icon, arrow, arrowAnim, title, desc }) => (
              <div
                key={title}
                className="bg-surface rounded-xl p-4 flex flex-col gap-2.5 border border-hairline/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{icon}</span>
                  <span
                    className={`hint-arrow ${arrowAnim} text-accent font-bold text-base leading-none`}
                  >
                    {arrow}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink leading-tight">{title}</p>
                  <p className="text-[11px] text-ink-muted leading-snug mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onDismiss}
            className="w-full bg-accent text-accent-ink font-semibold text-sm py-3 rounded-xl hover:bg-accent-hover transition-colors ease-spring"
          >
            Start reading  →
          </button>
        </div>
      </div>
    </>
  );
}
