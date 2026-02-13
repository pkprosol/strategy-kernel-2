import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecordById, deleteRecord, getRecordVersions, trackEvent } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const record = getRecordById(userId, parseInt(params.id));

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const versions = getRecordVersions(record.id);
  return NextResponse.json({ record, versions });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const deleted = deleteRecord(userId, parseInt(params.id));

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  trackEvent(userId, 'record.delete', 'web', { id: params.id });
  return NextResponse.json({ success: true });
}
