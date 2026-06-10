'use client';

import { useEffect, useState } from 'react';

type Theme = 'noir' | 'swiss';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('noir');

  useEffect(() => {
    const saved = (localStorage.getItem('breve-theme') as Theme) || 'noir';
    setTheme(saved);
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('breve-theme', t);
  };

  const toggle = () => apply(theme === 'noir' ? 'swiss' : 'noir');

  return (
    <button
      onClick={toggle}
      title={theme === 'noir' ? 'Switch to Swiss (light)' : 'Switch to Noir (dark)'}
      aria-label="Toggle theme"
      className="flex-shrink-0 flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink border border-hairline rounded-full px-2.5 py-1 transition-colors"
    >
      {theme === 'noir' ? (
        <>
          <span className="text-accent">◆</span>
          <span className="hidden sm:inline">Noir</span>
        </>
      ) : (
        <>
          <span className="text-accent">■</span>
          <span className="hidden sm:inline">Swiss</span>
        </>
      )}
    </button>
  );
}
