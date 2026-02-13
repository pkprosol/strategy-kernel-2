import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecords, upsertRecord, searchRecords, trackEvent } from '@/lib/db';
import { seedUserRecords } from '@/lib/records';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain') || undefined;
  const status = searchParams.get('status') || undefined;
  const query = searchParams.get('q') || undefined;

  let records;
  if (query) {
    records = searchRecords(userId, query, domain);
  } else {
    records = getRecords(userId, { domain, status });
  }

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const body = await req.json();
  const { domain, record_type, slug, title, content, structured_data, priority, status, record_date, source } = body;

  if (!domain || !record_type || !slug || !title) {
    return NextResponse.json({ error: 'Missing required fields: domain, record_type, slug, title' }, { status: 400 });
  }

  const record = upsertRecord(userId, {
    domain,
    record_type,
    slug,
    title,
    content: content || '',
    structured_data,
    priority,
    status,
    record_date,
    source: source || 'manual',
  });

  trackEvent(userId, 'record.upsert', 'web', { domain, slug });

  return NextResponse.json({ record });
}
