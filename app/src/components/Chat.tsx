'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  context: any;
  onExerciseComplete?: (content: string, structuredData?: Record<string, unknown>) => void;
}

export default function Chat({ context, onExerciseComplete }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, messages: newMessages }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setMessages([...newMessages, { role: 'assistant', content: fullText }]);
        }
      }

      // Check for exercise completion
      if (onExerciseComplete) {
        try {
          const parsed = JSON.parse(fullText);
          if (parsed.exercise_complete && parsed.document) {
            onExerciseComplete(parsed.document, parsed.structured_rewards ? { structured_rewards: parsed.structured_rewards } : undefined);
          }
        } catch {
          // Not JSON, check if it contains the marker
          const match = fullText.match(/\{"exercise_complete"\s*:\s*true\s*,\s*"document"\s*:\s*"([\s\S]*?)"\s*\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.document) onExerciseComplete(parsed.document, parsed.structured_rewards ? { structured_rewards: parsed.structured_rewards } : undefined);
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Error connecting to AI.' }]);
    }

    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-8">Start a conversation...</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] md:max-w-[80%] rounded-lg px-3 md:px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={streaming}
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
