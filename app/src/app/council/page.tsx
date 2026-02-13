'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { BUILTIN_AGENTS } from '@/lib/agents';

function CouncilView() {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [transcript, setTranscript] = useState('');
  const [running, setRunning] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo(0, transcriptRef.current.scrollHeight);
  }, [transcript]);

  function toggleAgent(id: string) {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function startDebate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedAgents.length < 2 || !topic.trim()) return;

    setRunning(true);
    setTranscript('');

    const res = await fetch('/api/council', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentIds: selectedAgents, topic: topic.trim() }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTranscript((prev) => prev + chunk);
      }
    }

    setRunning(false);
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <h2 className="text-xl md:text-2xl font-bold text-zinc-100 mb-4">Council of Advisors</h2>

      <div className="mb-4">
        <p className="text-sm text-zinc-500 mb-2">Select 2-6 advisors for the debate:</p>
        <div className="flex gap-2 flex-wrap">
          {BUILTIN_AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => toggleAgent(a.id)}
              disabled={running}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedAgents.includes(a.id)
                  ? 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {a.avatar} {a.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={startDebate} className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic for the council to debate..."
          disabled={running}
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={running || selectedAgents.length < 2 || !topic.trim()}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 whitespace-nowrap"
        >
          {running ? 'Debating...' : 'Start Debate'}
        </button>
      </form>

      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg p-4 md:p-6"
      >
        {transcript ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{transcript}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm text-center mt-8">
            Select advisors and enter a topic to begin.
          </p>
        )}
      </div>
    </div>
  );
}

export default function CouncilPage() {
  return (
    <Providers>
      <Shell>
        <CouncilView />
      </Shell>
    </Providers>
  );
}
