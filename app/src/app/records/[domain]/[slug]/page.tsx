'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { RecordRow, RecordVersionRow } from '@/lib/types';

function RecordDetail() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<RecordRow | null>(null);
  const [versions, setVersions] = useState<RecordVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/records?domain=${params.domain}`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data.records || []).find(
          (r: RecordRow) => r.slug === params.slug
        );
        if (found) {
          setRecord(found);
          setEditContent(found.content);
          setEditTitle(found.title);
          // Load versions
          fetch(`/api/records/${found.id}`)
            .then((r) => r.json())
            .then((d) => setVersions(d.versions || []));
        }
        setLoading(false);
      });
  }, [params.domain, params.slug]);

  async function handleSave() {
    if (!record) return;
    setSaving(true);
    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: record.domain,
        record_type: record.record_type,
        slug: record.slug,
        title: editTitle,
        content: editContent,
        priority: record.priority,
      }),
    });
    setSaving(false);
    setEditing(false);
    setRecord({ ...record, title: editTitle, content: editContent, updated_at: new Date().toISOString() });
  }

  async function handleDelete() {
    if (!record || !confirm('Delete this record?')) return;
    await fetch(`/api/records/${record.id}`, { method: 'DELETE' });
    router.push('/records');
  }

  if (loading) return <p className="text-zinc-500">Loading...</p>;
  if (!record) return <p className="text-zinc-500">Record not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <a href="/records" className="text-xs text-zinc-600 hover:text-zinc-400">
            &larr; Records
          </a>
          <span className="text-xs text-zinc-700 mx-2">/</span>
          <span className="text-xs text-zinc-500">{record.domain}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded hover:border-zinc-700"
          >
            {editing ? 'Preview' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 text-sm text-red-500 hover:text-red-400 border border-zinc-800 rounded hover:border-red-900"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-lg text-zinc-100 font-semibold focus:outline-none focus:border-zinc-600"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={24}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-zinc-100 text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(record.content);
                setEditTitle(record.title);
              }}
              className="px-4 py-1.5 text-zinc-400 text-sm hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">{record.title}</h1>
          <div className="flex gap-3 text-xs text-zinc-600 mb-6">
            <span>{record.domain}/{record.record_type}</span>
            <span>Priority: {record.priority}</span>
            <span>Source: {record.source}</span>
            <span>Updated: {new Date(record.updated_at).toLocaleString()}</span>
          </div>
          <div className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{record.content}</ReactMarkdown>
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">
            Version History ({versions.length})
          </h3>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="text-xs text-zinc-600">
                Version from {new Date(v.created_at).toLocaleString()} ({v.content.length} chars)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordPage() {
  return (
    <Providers>
      <Shell>
        <RecordDetail />
      </Shell>
    </Providers>
  );
}
