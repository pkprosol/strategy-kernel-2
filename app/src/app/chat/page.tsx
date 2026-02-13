'use client';

import { useState } from 'react';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import Chat from '@/components/Chat';
import { BUILTIN_AGENTS } from '@/lib/agents';

type Mode = 'strategy' | 'evolve' | 'daily-brief' | 'review';

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: 'strategy', label: 'Strategy', description: 'High-level life strategy and priorities' },
  { id: 'evolve', label: 'Evolve', description: 'Personal growth and self-awareness' },
  { id: 'daily-brief', label: 'Daily Brief', description: 'Start your day with clarity' },
  { id: 'review', label: 'Review', description: 'Reflect on recent progress' },
];

function ChatContent() {
  const [contextType, setContextType] = useState<'mode' | 'advisor'>('mode');
  const [mode, setMode] = useState<Mode>('strategy');
  const [advisorId, setAdvisorId] = useState<string>('');
  const [chatKey, setChatKey] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  const context =
    contextType === 'advisor' && advisorId
      ? { type: 'advisor' as const, agentId: advisorId }
      : { type: 'mode' as const, mode };

  function switchContext(type: 'mode' | 'advisor', value: string) {
    if (type === 'mode') {
      setContextType('mode');
      setMode(value as Mode);
    } else {
      setContextType('advisor');
      setAdvisorId(value);
    }
    setChatKey((k) => k + 1);
    setPanelOpen(false);
  }

  const currentLabel =
    contextType === 'advisor'
      ? BUILTIN_AGENTS.find((a) => a.id === advisorId)?.name || 'Advisor'
      : MODES.find((m) => m.id === mode)?.label || 'Strategy';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-120px)]">
      {/* Mobile context selector */}
      <div className="md:hidden mb-3">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 w-full"
        >
          <span className="flex-1 text-left">{currentLabel}</span>
          <span className="text-zinc-500 text-xs">{panelOpen ? '▲' : '▼'}</span>
        </button>
        {panelOpen && (
          <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Modes</h3>
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => switchContext('mode', m.id)}
                    className={`px-3 py-1.5 rounded-md text-sm ${
                      contextType === 'mode' && mode === m.id
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Advisors</h3>
              <div className="flex flex-wrap gap-2">
                {BUILTIN_AGENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => switchContext('advisor', a.id)}
                    className={`px-3 py-1.5 rounded-md text-sm ${
                      contextType === 'advisor' && advisorId === a.id
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {a.avatar} {a.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-48 border-r border-zinc-800 pr-4 space-y-4 overflow-y-auto flex-shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Modes</h3>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => switchContext('mode', m.id)}
                className={`block w-full text-left px-2 py-1.5 rounded text-sm mb-1 ${
                  contextType === 'mode' && mode === m.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Advisors</h3>
            {BUILTIN_AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => switchContext('advisor', a.id)}
                className={`block w-full text-left px-2 py-1.5 rounded text-sm mb-1 ${
                  contextType === 'advisor' && advisorId === a.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {a.avatar} {a.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 md:pl-4 min-w-0">
          <Chat key={chatKey} context={context} />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Providers>
      <Shell>
        <ChatContent />
      </Shell>
    </Providers>
  );
}
