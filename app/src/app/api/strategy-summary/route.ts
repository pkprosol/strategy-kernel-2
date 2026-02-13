import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecords } from '@/lib/db';
import { EXERCISES } from '@/lib/exercises';

const PLACEHOLDER_MARKERS = ['[Complete the', '[Use the', '[Fill in', '[Your '];

function isPlaceholder(content: string): boolean {
  return PLACEHOLDER_MARKERS.some((m) => content.includes(m));
}

function isEmptyTemplate(content: string): boolean {
  return content.split('\n').every((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || t === '---') return true;
    if (/^[-\u2022*]?\s*\*\*[^*]+:\*\*\s*$/.test(t)) return true;
    if (/^\*\*(?:Last Updated|Created):\*\*\s*\S*$/.test(t)) return true;
    return false;
  });
}

function cleanContent(content: string | null | undefined): string | null {
  if (!content) return null;
  if (isPlaceholder(content)) return null;
  if (isEmptyTemplate(content)) return null;
  return content;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const allRecords = getRecords(userId, { status: 'active', limit: 1000 });

  const findRecord = (domain: string, slug: string) =>
    allRecords.find((r) => r.domain === domain && r.slug === slug);

  const profile = cleanContent(findRecord('strategy', 'biographical-profile')?.content);
  const grandStrategy = cleanContent(findRecord('strategy', 'personal-grand-strategy')?.content);
  const northStar = cleanContent(findRecord('assessment', 'ideal-self-north-star')?.content);
  const values = cleanContent(findRecord('belief', 'values-hierarchy')?.content);
  const vision = cleanContent(findRecord('strategy', 'life-vision-3-5-year')?.content);
  const currentWeek = cleanContent(findRecord('strategy', 'current-week-practice')?.content);

  // Collect recent daily briefs (last 5)
  const recentBriefs = allRecords
    .filter((r) => r.record_type === 'daily-brief')
    .sort((a, b) => b.slug.localeCompare(a.slug))
    .slice(0, 5)
    .map((r) => ({ slug: r.slug, title: r.title }));

  // Determine exercise completion status
  const exercises = EXERCISES.map((ex) => {
    const record = findRecord(ex.output_domain, ex.output_slug);
    const completed = record !== undefined && !isPlaceholder(record.content);
    return {
      id: ex.id,
      name: ex.name,
      icon: ex.icon,
      completed,
    };
  });

  return NextResponse.json({
    profile,
    grandStrategy,
    northStar,
    values,
    vision,
    currentWeek,
    exercises,
    recentBriefs,
  });
}
