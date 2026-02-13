import { upsertRecord } from './db';

// Re-export from domains for server-side use
export { DOMAINS, getDomain, slugify } from './domains';
export type { DomainId } from './domains';

// ── Seed Templates ─────────────────────────────────────────

const SEED_RECORDS = [
  {
    domain: 'strategy',
    record_type: 'biographical-profile',
    slug: 'biographical-profile',
    title: 'Biographical Profile',
    content: `# Biographical Profile

## Basic Information
- **Name:**
- **Age:**
- **Location:**
- **Occupation:**

## Background
Write a brief overview of your life story, key experiences, and formative moments.

## Current Situation
Where are you now in life? What defines your current chapter?

## Key Strengths


## Key Challenges

`,
    priority: 4,
  },
  {
    domain: 'strategy',
    record_type: 'grand-strategy',
    slug: 'personal-grand-strategy',
    title: 'Personal Grand Strategy',
    content: `# Personal Grand Strategy

## Mission
What is your core purpose? What are you here to do?

## Vision (10+ years)
What does your ideal life look like in a decade?

## Strategic Pillars
What are the 3-5 key areas you're building?

1. **Pillar 1:**
2. **Pillar 2:**
3. **Pillar 3:**

## Current Strategic Priorities (This Quarter)
1.
2.
3.

## Principles
What rules govern your decision-making?

`,
    priority: 4,
  },
  {
    domain: 'strategy',
    record_type: 'current-week',
    slug: 'current-week-practice',
    title: 'Current Week Practice',
    content: `# Current Week Practice

## Focus Areas This Week
1.
2.
3.

## Key Habits to Maintain
-
-
-

## Experiments / New Behaviors
-

## End-of-Week Success Criteria
- [ ]
- [ ]
- [ ]
`,
    priority: 3,
  },
];

export function seedUserRecords(userId: number): void {
  for (const seed of SEED_RECORDS) {
    upsertRecord(userId, {
      domain: seed.domain,
      record_type: seed.record_type,
      slug: seed.slug,
      title: seed.title,
      content: seed.content,
      priority: seed.priority,
      source: 'system',
    });
  }
}
