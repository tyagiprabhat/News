import dynamic from 'next/dynamic';

const NewsFeed = dynamic(() => import('@/components/NewsFeed'), { ssr: false });
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), { ssr: false });

export default function Home() {
  return (
    <main className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Header strip */}
      <div className="fixed top-0 left-0 right-0 z-10 h-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 flex items-center px-4 gap-3">
        <span className="text-lg">🇪🇺</span>
        <span className="text-sm font-semibold text-gray-200">EU News AI</span>
        <span className="text-gray-700 text-xs">|</span>
        <span className="text-xs text-gray-500">AP · Reuters · BBC · NPR · Al Jazeera · France 24 · RFI · Euronews · Politico · DW · The Hindu · TOI · The Economist</span>
      </div>

      {/* Left panel — news feed */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-800 mt-10 flex flex-col">
        <NewsFeed />
      </aside>

      {/* Right panel — chat */}
      <section className="flex-1 mt-10 flex flex-col min-w-0">
        <ChatInterface />
      </section>
    </main>
  );
}
