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
  }

  return (
    <div className="flex h-[calc(100vh-120px)]">
      <div className="w-48 border-r border-zinc-800 pr-4 space-y-4 overflow-y-auto">
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
      <div className="flex-1 pl-4">
        <Chat key={chatKey} context={context} />
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
