'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect } from 'react';

const SUGGESTIONS = [
  "Give me a morning briefing of top world stories",
  "What's breaking in Asia-Pacific right now?",
  "Briefing: top 5 India stories today in Hindi",
  "Compare how Al Jazeera and BBC frame the same story",
  "What's trending across all 25 sources right now?",
];

function ToolCallBadge({ toolName, state }: { toolName: string; state: string }) {
  const labels: Record<string, string> = {
    fetchLatestNews: '📡 Fetching live news',
    searchNews: '🔍 Searching articles',
    profileSources: '📋 Loading source profiles',
    analyzeCoverage: '📊 Analyzing coverage',
    translateText: '🌐 Translating',
    generateBriefing: '📰 Building briefing',
  };

  return (
    <div className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
      state === 'result'
        ? 'border-accent/50 text-accent bg-accent/5'
        : 'border-hairline text-ink-muted bg-surface'
    }`}>
      {state !== 'result' && (
        <span className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      )}
      {state === 'result' ? '✓ ' : ''}{labels[toolName] || toolName}
    </div>
  );
}

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      <div className="px-4 py-3 border-b border-hairline flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-accent" />
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">Brève Agent</h2>
          <p className="text-xs text-ink-muted">Powered by Gemini 2.5 Flash — 25 live sources, 6 regions</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <div className="font-display text-4xl font-semibold text-accent mb-3">Brève</div>
              <h3 className="font-display text-lg font-semibold text-ink mb-1">Ask about world news</h3>
              <p className="text-sm text-ink-muted max-w-sm">
                I fetch live articles from 25 free sources across the Americas, Europe, Middle East &amp; Africa, Asia-Pacific, and India — and can summarize, compare coverage, or translate into French, German, Arabic, Hindi, Spanish, and more.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => submitSuggestion(s)}
                  className="text-left text-sm text-ink-muted hover:text-ink bg-surface hover:bg-surface2 border border-hairline hover:border-accent rounded-lg px-4 py-2.5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                {message.role === 'assistant' && message.toolInvocations && message.toolInvocations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.toolInvocations.map((t, ti) => (
                      <ToolCallBadge key={ti} toolName={t.toolName} state={t.state} />
                    ))}
                  </div>
                )}
                {message.content && (
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-accent text-accent-ink rounded-br-sm'
                      : 'bg-surface text-ink border border-hairline rounded-bl-sm'
                  }`}>
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-surface border border-hairline rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-hairline">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about world news…"
            disabled={isLoading}
            className="flex-1 bg-surface border border-hairline rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-accent text-accent-ink rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
