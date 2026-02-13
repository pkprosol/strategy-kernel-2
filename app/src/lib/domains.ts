export const DOMAINS = [
  { id: 'strategy', label: 'Strategy', icon: '🎯', description: 'High-level life strategy and vision' },
  { id: 'assessment', label: 'Assessments', icon: '🔍', description: 'Self-assessments and evaluations' },
  { id: 'goal', label: 'Goals', icon: '🏆', description: 'Goals and objectives' },
  { id: 'habit', label: 'Habits', icon: '🔄', description: 'Habits and routines' },
  { id: 'health', label: 'Health', icon: '💪', description: 'Health and wellness records' },
  { id: 'journal', label: 'Journal', icon: '📝', description: 'Journal entries and reflections' },
  { id: 'finance', label: 'Finance', icon: '💰', description: 'Financial records and plans' },
  { id: 'relationship', label: 'Relationships', icon: '🤝', description: 'Relationship insights and maps' },
  { id: 'belief', label: 'Beliefs', icon: '💡', description: 'Core beliefs and values' },
  { id: 'project', label: 'Projects', icon: '📋', description: 'Projects and initiatives' },
  { id: 'exercise-output', label: 'Exercise Outputs', icon: '✍️', description: 'Results from guided exercises' },
  { id: 'daily-brief', label: 'Daily Briefs', icon: '☀️', description: 'Daily intentions and check-ins' },
  { id: 'observation', label: 'Observations', icon: '👁️', description: 'Observations and insights' },
  { id: 'note', label: 'Notes', icon: '📌', description: 'General notes and captures' },
] as const;

export type DomainId = (typeof DOMAINS)[number]['id'];

export function getDomain(id: string) {
  return DOMAINS.find((d) => d.id === id);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
