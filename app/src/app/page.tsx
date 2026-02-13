'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { RecordRow } from '@/lib/types';

function DashboardContent() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    // Seed records on first visit
    fetch('/api/seed', { method: 'POST' }).then(() => {
      fetch('/api/records')
        .then((r) => r.json())
        .then((data) => {
          setRecords(data.records || []);
          setLoading(false);
        });
    });
  }, [session]);

  const grouped: Record<string, RecordRow[]> = {};
  for (const r of records) {
    if (!grouped[r.domain]) grouped[r.domain] = [];
    grouped[r.domain].push(r);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-100 mb-6">Dashboard</h2>

      {loading ? (
        <p className="text-zinc-500">Loading records...</p>
      ) : records.length === 0 ? (
        <p className="text-zinc-500">No records yet. Start by exploring exercises or creating a record.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(grouped).map(([domain, recs]) => (
            <div key={domain} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
                {domain} ({recs.length})
              </h3>
              <div className="space-y-2">
                {recs.slice(0, 5).map((r) => (
                  <a
                    key={r.id}
                    href={`/records/${r.domain}/${r.slug}`}
                    className="block text-sm text-zinc-400 hover:text-zinc-200 transition-colors truncate"
                  >
                    {r.priority > 2 && <span className="text-yellow-500 mr-1">{'*'.repeat(r.priority)}</span>}
                    {r.title}
                  </a>
                ))}
                {recs.length > 5 && (
                  <a href={`/records?domain=${domain}`} className="text-xs text-zinc-600 hover:text-zinc-400">
                    +{recs.length - 5} more
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/chat" className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
          <h3 className="font-semibold text-zinc-200 mb-1">Strategy Chat</h3>
          <p className="text-sm text-zinc-500">Talk through decisions, goals, and life strategy with AI.</p>
        </a>
        <a href="/exercises" className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
          <h3 className="font-semibold text-zinc-200 mb-1">Exercises</h3>
          <p className="text-sm text-zinc-500">Guided self-discovery and reflection exercises.</p>
        </a>
        <a href="/council" className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
          <h3 className="font-semibold text-zinc-200 mb-1">Council of Advisors</h3>
          <p className="text-sm text-zinc-500">Get perspectives from multiple AI advisors on a topic.</p>
        </a>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Providers>
      <Shell>
        <DashboardContent />
      </Shell>
    </Providers>
  );
}
