'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import ThemeToggle from '@/components/ThemeToggle';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const NewsFeed = dynamic(() => import('@/components/NewsFeed'), { ssr: false });
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), { ssr: false });

type ViewMode = 'web' | 'phone';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

function Wordmark() {
  return (
    <div className="flex flex-col leading-none">
      <span className="font-display text-lg font-semibold tracking-tight text-ink">Brève</span>
      <span className="rule-accent w-10 mt-0.5" />
    </div>
  );
}

export default function AppShell() {
  const isDesktop = useIsDesktop();
  const [viewMode, setViewMode] = useState<ViewMode>('web');
  const [chatOpen, setChatOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const standalone = ('standalone' in navigator) && (navigator as Navigator & { standalone?: boolean }).standalone;
    if (ios && !standalone) setIsIos(true);

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  // Phone-preview mode is desktop-only; on real mobile we always show the native deck.
  const phonePreview = isDesktop && viewMode === 'phone';
  const deckWords = isDesktop && viewMode === 'web' ? 90 : 60;

  const feed = <NewsFeed words={deckWords} />;

  return (
    <main className="flex flex-col h-[100dvh] bg-canvas overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 glass border-b border-hairline flex items-center px-4 gap-3 z-20">
        <Wordmark />
        <span className="hidden md:inline text-xs text-ink-muted truncate ml-2">
          The world&apos;s news in 60 words
        </span>

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* Desktop device toggle */}
          {isDesktop && (
            <div className="flex items-center rounded-full border border-hairline overflow-hidden">
              <button
                onClick={() => setViewMode('web')}
                className={`px-2.5 py-1 text-xs transition-colors ${viewMode === 'web' ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
                title="Web view"
              >
                🖥
              </button>
              <button
                onClick={() => setViewMode('phone')}
                className={`px-2.5 py-1 text-xs transition-colors ${viewMode === 'phone' ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
                title="Mobile preview"
              >
                📱
              </button>
            </div>
          )}

          {installPrompt && !installed && (
            <button
              onClick={handleInstall}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-accent text-accent-ink px-3 py-1 rounded-full font-medium hover:bg-accent-hover transition-colors"
            >
              ⬇ Install
            </button>
          )}
          {isIos && !showIosHint && !installed && (
            <button
              onClick={() => setShowIosHint(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-accent text-accent-ink px-3 py-1 rounded-full font-medium"
            >
              ⬇ Install
            </button>
          )}
          <ThemeToggle />
          {CLERK_ENABLED && (
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
          )}
        </div>
      </header>

      {/* iOS install hint */}
      {showIosHint && (
        <div className="flex-shrink-0 bg-surface border-b border-hairline px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-ink">
          <span>Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong> to install.</span>
          <button onClick={() => setShowIosHint(false)} className="text-accent font-bold text-sm flex-shrink-0">✕</button>
        </div>
      )}

      {/* Mobile install banner */}
      {installPrompt && !installed && (
        <div className="sm:hidden flex-shrink-0 bg-surface border-b border-hairline px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold text-accent">Brève</span>
            <div>
              <p className="text-xs font-semibold text-ink">Install Brève</p>
              <p className="text-xs text-ink-muted">Add to your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstall} className="text-xs bg-accent text-accent-ink px-3 py-1.5 rounded-full font-medium">
              Install
            </button>
            <button onClick={() => setInstallPrompt(null)} className="text-ink-muted text-sm">✕</button>
          </div>
        </div>
      )}

      {/* Main — full-screen InShorts card deck */}
      <div className="flex-1 min-h-0 relative">
        {phonePreview ? (
          <div className="h-full flex items-center justify-center bg-surface2/30 py-5">
            {/* Phone frame preview on desktop */}
            <div className="relative h-full max-h-[860px] aspect-[9/19] rounded-[2.4rem] border-[6px] border-ink/80 bg-canvas overflow-hidden shadow-card">
              <div className="absolute top-0 inset-x-0 h-5 flex justify-center z-10 pointer-events-none">
                <span className="w-24 h-5 bg-ink/80 rounded-b-2xl" />
              </div>
              {feed}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full lg:max-w-[560px] h-full lg:border-x lg:border-hairline">
            {feed}
          </div>
        )}
      </div>

      {/* Floating Brève AI button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-accent text-accent-ink rounded-full pl-4 pr-5 py-3 font-medium shadow-card hover:bg-accent-hover transition-colors ease-spring"
        >
          <span className="text-base">✦</span>
          <span className="text-sm">Brève AI</span>
        </button>
      )}

      {/* Brève AI drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setChatOpen(false)}
          />
          <div className="relative w-full sm:w-[440px] h-full bg-canvas border-l border-hairline flex flex-col animate-[slideIn_0.2s_ease-out]">
            <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-hairline">
              <span className="font-display text-sm font-semibold text-ink">✦ Brève AI</span>
              <button
                onClick={() => setChatOpen(false)}
                className="text-ink-muted hover:text-ink text-lg leading-none px-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatInterface />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
