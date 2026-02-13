'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { RecordRow } from '@/lib/types';
import { DOMAINS, slugify } from '@/lib/domains';

function RecordBrowser() {
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState<string | null>(searchParams.get('domain'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState({ domain: 'note', record_type: 'note', title: '', content: '' });

  function loadRecords() {
    const params = new URLSearchParams();
    if (activeDomain) params.set('domain', activeDomain);
    if (searchQuery) params.set('q', searchQuery);

    fetch(`/api/records?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records || []);
        setLoading(false);
      });
  }

  useEffect(() => { loadRecords(); }, [activeDomain]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    loadRecords();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const slug = slugify(newRecord.title);
    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRecord, slug }),
    });
    setShowCreate(false);
    setNewRecord({ domain: 'note', record_type: 'note', title: '', content: '' });
    loadRecords();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-zinc-100">Records</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          New Record
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Domain</label>
              <select
                value={newRecord.domain}
                onChange={(e) => setNewRecord({ ...newRecord, domain: e.target.value, record_type: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200"
              >
                {DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>{d.icon} {d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Type</label>
              <input
                type="text"
                value={newRecord.record_type}
                onChange={(e) => setNewRecord({ ...newRecord, record_type: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Title</label>
            <input
              type="text"
              value={newRecord.title}
              onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Content (Markdown)</label>
            <textarea
              value={newRecord.content}
              onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
              rows={6}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded text-sm font-medium hover:bg-zinc-200">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-zinc-400 text-sm hover:text-zinc-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
          <button type="submit" className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-md text-sm hover:bg-zinc-700">
            Search
          </button>
        </form>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        <button
          onClick={() => setActiveDomain(null)}
          className={`px-2 py-1 rounded text-xs ${!activeDomain ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
        >
          All
        </button>
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDomain(d.id)}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 ${activeDomain === d.id ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
          >
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : records.length === 0 ? (
        <p className="text-zinc-500">No records found.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <a
              key={r.id}
              href={`/records/${r.domain}/${r.slug}`}
              className="block p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-zinc-200 block truncate">{r.title}</span>
                  <span className="text-xs text-zinc-600">{r.domain}/{r.record_type}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.priority > 0 && (
                    <span className="text-xs text-yellow-600">P{r.priority}</span>
                  )}
                  <span className="text-xs text-zinc-600 hidden sm:inline">{new Date(r.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              {r.content && (
                <p className="text-xs text-zinc-500 mt-1 truncate">{r.content.slice(0, 120)}</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Providers>
      <Shell>
        <RecordBrowser />
      </Shell>
    </Providers>
  );
}
