'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import ThemeToggle from '@/components/ThemeToggle';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const NewsFeed = dynamic(() => import('@/components/NewsFeed'), { ssr: false });
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), { ssr: false });

type Tab = 'feed' | 'chat';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
  const [activeTab, setActiveTab] = useState<Tab>('feed');
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

  return (
    <main className="flex flex-col h-[100dvh] bg-canvas overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-canvas/95 backdrop-blur border-b border-hairline flex items-center px-4 gap-3 z-10">
        <Wordmark />
        <span className="hidden md:inline text-xs text-ink-muted truncate ml-2">
          The world&apos;s news in 60 words — 25 sources, 6 regions
        </span>

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {installPrompt && !installed && (
            <button
              onClick={handleInstall}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-accent text-accent-ink px-3 py-1 rounded-full font-medium hover:opacity-90 transition-opacity"
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
            <button
              onClick={handleInstall}
              className="text-xs bg-accent text-accent-ink px-3 py-1.5 rounded-full font-medium"
            >
              Install
            </button>
            <button onClick={() => setInstallPrompt(null)} className="text-ink-muted text-sm">✕</button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        <aside className={`
          lg:w-[440px] lg:flex-shrink-0 lg:border-r lg:border-hairline lg:flex
          ${activeTab === 'feed' ? 'flex' : 'hidden'}
          flex-col w-full
        `}>
          <NewsFeed />
        </aside>

        <section className={`
          lg:flex flex-1 min-w-0
          ${activeTab === 'chat' ? 'flex' : 'hidden'}
          flex-col
        `}>
          <ChatInterface />
        </section>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden flex-shrink-0 flex border-t border-hairline bg-canvas safe-area-inset-bottom">
        <button
          onClick={() => setActiveTab('feed')}
          className={`relative flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'feed' ? 'text-accent' : 'text-ink-muted'
          }`}
        >
          <span className="text-xl leading-none">📰</span>
          <span className="text-[10px] font-medium mt-0.5 tracking-wide">FEED</span>
          {activeTab === 'feed' && <span className="absolute top-0 w-10 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`relative flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'chat' ? 'text-accent' : 'text-ink-muted'
          }`}
        >
          <span className="text-xl leading-none">💬</span>
          <span className="text-[10px] font-medium mt-0.5 tracking-wide">AGENT</span>
          {activeTab === 'chat' && <span className="absolute top-0 w-10 h-0.5 bg-accent" />}
        </button>
      </nav>
    </main>
  );
}
