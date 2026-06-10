'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const NewsFeed = dynamic(() => import('@/components/NewsFeed'), { ssr: false });
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), { ssr: false });

type Tab = 'feed' | 'chat';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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

    // Detect iOS Safari
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

  const showBanner = !installed && (installPrompt || (isIos && !showIosHint));

  return (
    <main className="flex flex-col h-[100dvh] bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-11 bg-gray-950/95 backdrop-blur border-b border-gray-800 flex items-center px-4 gap-3 z-10">
        <span className="text-base">⚡</span>
        <span className="text-sm font-semibold text-gray-200">Brève</span>
        <span className="hidden sm:inline text-gray-700 text-xs">|</span>
        <span className="hidden sm:inline text-xs text-gray-500 truncate">
          The world&apos;s news in 60 words — 21 sources, 6 regions
        </span>
        {CLERK_ENABLED && (
          <div className="ml-auto flex-shrink-0 flex items-center">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{ elements: { avatarBox: 'w-7 h-7' } }}
            />
          </div>
        )}

        {/* Install button — desktop */}
        {installPrompt && !installed && (
          <button
            onClick={handleInstall}
            className="hidden sm:flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full transition-colors flex-shrink-0"
          >
            ⬇ Install App
          </button>
        )}
        {isIos && !showIosHint && !installed && (
          <button
            onClick={() => setShowIosHint(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full transition-colors flex-shrink-0"
          >
            ⬇ Install App
          </button>
        )}
      </header>

      {/* iOS install hint */}
      {showIosHint && (
        <div className="flex-shrink-0 bg-blue-950 border-b border-blue-800 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-blue-200">
          <span>Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong> to install.</span>
          <button onClick={() => setShowIosHint(false)} className="text-blue-400 font-bold text-sm flex-shrink-0">✕</button>
        </div>
      )}

      {/* Mobile install banner */}
      {installPrompt && !installed && (
        <div className="sm:hidden flex-shrink-0 bg-blue-950 border-b border-blue-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-xs font-semibold text-blue-200">Install Brève</p>
              <p className="text-xs text-blue-400">Add to your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full font-medium transition-colors"
            >
              Install
            </button>
            <button onClick={() => setInstallPrompt(null)} className="text-blue-400 text-sm">✕</button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Feed panel */}
        <aside className={`
          lg:w-[420px] lg:flex-shrink-0 lg:border-r lg:border-gray-800 lg:flex
          ${activeTab === 'feed' ? 'flex' : 'hidden'}
          flex-col w-full
        `}>
          <NewsFeed />
        </aside>

        {/* Chat panel */}
        <section className={`
          lg:flex flex-1 min-w-0
          ${activeTab === 'chat' ? 'flex' : 'hidden'}
          flex-col
        `}>
          <ChatInterface />
        </section>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden flex-shrink-0 flex border-t border-gray-800 bg-gray-950 safe-area-inset-bottom">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'feed' ? 'text-blue-400' : 'text-gray-600 active:text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">📰</span>
          <span className="text-[10px] font-medium mt-0.5">Feed</span>
          {activeTab === 'feed' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-blue-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors relative ${
            activeTab === 'chat' ? 'text-blue-400' : 'text-gray-600 active:text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">💬</span>
          <span className="text-[10px] font-medium mt-0.5">AI Chat</span>
          {activeTab === 'chat' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-blue-400 rounded-full" />
          )}
        </button>
      </nav>
    </main>
  );
}
