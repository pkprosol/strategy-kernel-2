import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecords } from '@/lib/db';
import { seedUserRecords } from '@/lib/records';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const existing = getRecords(userId, { limit: 1 });

  if (existing.length === 0) {
    seedUserRecords(userId);
    return NextResponse.json({ seeded: true });
  }

  return NextResponse.json({ seeded: false, message: 'Records already exist' });
}
