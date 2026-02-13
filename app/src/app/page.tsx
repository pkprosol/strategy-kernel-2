'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { RecordRow } from '@/lib/types';

// ── Reward System ─────────────────────────────────────────
interface RewardItem {
  emoji: string;
  text: string;
}

interface RewardMenu {
  small: RewardItem[];
  medium: RewardItem[];
  large: RewardItem[];
}

const DEFAULT_REWARDS: RewardItem[] = [
  { emoji: '☕', text: 'Treat yourself to a nice coffee' },
  { emoji: '🎵', text: '15 min of your favorite music, no guilt' },
  { emoji: '🚶', text: 'Take a 20-minute walk outside' },
  { emoji: '🍫', text: 'Have a small piece of dark chocolate' },
  { emoji: '📖', text: '30 min of pleasure reading' },
  { emoji: '🛁', text: 'Take a long shower or bath' },
  { emoji: '🎮', text: '30 min of guilt-free gaming' },
  { emoji: '📺', text: 'Watch one episode of something you love' },
  { emoji: '🧘', text: '10-minute guided meditation' },
  { emoji: '📱', text: 'Call a friend you haven\'t talked to in a while' },
  { emoji: '🍜', text: 'Order your favorite meal' },
  { emoji: '💤', text: 'Take a 20-minute power nap' },
  { emoji: '🎨', text: 'Spend 30 min on a creative hobby' },
  { emoji: '🌅', text: 'Go somewhere scenic and just sit' },
  { emoji: '🧃', text: 'Make yourself a fancy drink (smoothie, latte, etc.)' },
  { emoji: '🎧', text: 'Listen to a full album start to finish' },
];

function parseRewardsFromMarkdown(content: string): RewardMenu | null {
  const tiers: Record<string, RewardItem[]> = { small: [], medium: [], large: [] };
  let currentTier: string | null = null;

  for (const line of content.split('\n')) {
    const lower = line.toLowerCase();
    if (lower.includes('## small')) currentTier = 'small';
    else if (lower.includes('## medium')) currentTier = 'medium';
    else if (lower.includes('## large')) currentTier = 'large';
    else if (currentTier && line.includes('|')) {
      // Parse table row: | emoji | text |
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2 && !cells[0].startsWith('-') && cells[0].toLowerCase() !== 'emoji') {
        tiers[currentTier].push({ emoji: cells[0], text: cells[1] });
      }
    }
  }

  if (tiers.small.length === 0 && tiers.medium.length === 0 && tiers.large.length === 0) {
    return null;
  }
  return { small: tiers.small, medium: tiers.medium, large: tiers.large };
}

function pickReward(seed: number, customRewards?: RewardItem[]): RewardItem {
  const pool = customRewards && customRewards.length > 0 ? customRewards : DEFAULT_REWARDS;
  return pool[Math.abs(seed) % pool.length];
}

// ── Profile Completion Parser ──────────────────────────────
interface TodoItem {
  label: string;
  done: boolean;
  section: string;
}

function parseProfileTodos(content: string): TodoItem[] {
  const fields = [
    { label: 'Fill in your name', section: 'Name', pattern: /\*\*Name:\*\*\s*(.+)/i },
    { label: 'Fill in your age', section: 'Age', pattern: /\*\*Age:\*\*\s*(.+)/i },
    { label: 'Fill in your location', section: 'Location', pattern: /\*\*Location:\*\*\s*(.+)/i },
    { label: 'Fill in your occupation', section: 'Occupation', pattern: /\*\*Occupation:\*\*\s*(.+)/i },
  ];

  const sectionChecks = [
    { label: 'Write your background story', section: 'Background', header: '## Background' },
    { label: 'Describe your current situation', section: 'Current Situation', header: '## Current Situation' },
    { label: 'List your key strengths', section: 'Key Strengths', header: '## Key Strengths' },
    { label: 'Identify your key challenges', section: 'Key Challenges', header: '## Key Challenges' },
  ];

  const todos: TodoItem[] = [];

  for (const f of fields) {
    const match = content.match(f.pattern);
    const filled = match ? match[1].trim().length > 0 : false;
    todos.push({ label: f.label, done: filled, section: f.section });
  }

  for (const s of sectionChecks) {
    const idx = content.indexOf(s.header);
    if (idx === -1) {
      todos.push({ label: s.label, done: false, section: s.section });
      continue;
    }
    // Grab text between this header and the next ## or end
    const after = content.slice(idx + s.header.length);
    const nextHeader = after.indexOf('\n## ');
    const sectionText = nextHeader === -1 ? after : after.slice(0, nextHeader);
    const hasContent = sectionText.replace(/\n/g, '').replace(/[-*>\s]/g, '').trim().length > 0;
    todos.push({ label: s.label, done: hasContent, section: s.section });
  }

  return todos;
}

function parseStrategyTodos(content: string): TodoItem[] {
  const sections = [
    { label: 'Define your core mission', section: 'Mission', header: '## Mission' },
    { label: 'Envision your 10+ year vision', section: 'Vision', header: '## Vision' },
    { label: 'Establish your strategic pillars', section: 'Pillars', header: '## Strategic Pillars' },
    { label: 'Set this quarter\'s priorities', section: 'Priorities', header: '## Current Strategic Priorities' },
    { label: 'Define your decision-making principles', section: 'Principles', header: '## Principles' },
  ];

  const todos: TodoItem[] = [];

  for (const s of sections) {
    const idx = content.indexOf(s.header);
    if (idx === -1) {
      todos.push({ label: s.label, done: false, section: s.section });
      continue;
    }
    const after = content.slice(idx + s.header.length);
    const nextHeader = after.indexOf('\n## ');
    const sectionText = nextHeader === -1 ? after : after.slice(0, nextHeader);
    // Strip markdown formatting, list markers, numbering, placeholders
    const cleaned = sectionText
      .replace(/\*\*Pillar \d+:\*\*/g, '')
      .replace(/^\d+\.\s*/gm, '')
      .replace(/^[-*]\s*/gm, '')
      .replace(/\n/g, '')
      .replace(/[>\s]/g, '')
      .trim();
    const hasContent = cleaned.length > 0;
    todos.push({ label: s.label, done: hasContent, section: s.section });
  }

  return todos;
}

// ── Todo Section Component ─────────────────────────────────
function TodoSection({
  title,
  todos,
  recordLink,
  rewardSeed,
  customRewards,
}: {
  title: string;
  todos: TodoItem[];
  recordLink: string;
  rewardSeed: number;
  customRewards?: RewardItem[];
}) {
  const doneCount = todos.filter((t) => t.done).length;
  const allDone = doneCount === todos.length;
  const progress = todos.length > 0 ? (doneCount / todos.length) * 100 : 0;
  const reward = pickReward(rewardSeed, customRewards);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">{title}</h3>
        <span className="text-xs text-zinc-500">
          {doneCount}/{todos.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            allDone ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {allDone ? (
        <div className="text-center py-3">
          <p className="text-emerald-400 font-medium text-sm mb-2">All done! You&apos;ve earned a reward:</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 inline-block">
            <span className="text-2xl mr-2">{reward.emoji}</span>
            <span className="text-zinc-200 text-sm">{reward.text}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {todos.map((t, i) => (
              <a
                key={i}
                href={recordLink}
                className="flex items-center gap-2 group"
              >
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                    t.done
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'border-zinc-600 group-hover:border-zinc-400'
                  }`}
                >
                  {t.done && '✓'}
                </span>
                <span
                  className={`text-sm ${
                    t.done ? 'text-zinc-500 line-through' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </span>
              </a>
            ))}
          </div>
          <a
            href={recordLink}
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            Edit record to complete →
          </a>
        </>
      )}
    </div>
  );
}

// ── Daily Brief Status Component ──────────────────────────
function DailyBriefStatus({
  completed,
  rewardSeed,
  customRewards,
}: {
  completed: boolean;
  rewardSeed: number;
  customRewards?: RewardItem[];
}) {
  const reward = pickReward(rewardSeed, customRewards);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
        Daily Brief
      </h3>
      {completed ? (
        <div className="text-center py-3">
          <p className="text-emerald-400 font-medium text-sm mb-2">Brief complete! You earned:</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 inline-block">
            <span className="text-2xl mr-2">{reward.emoji}</span>
            <span className="text-zinc-200 text-sm">{reward.text}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Start your day with clarity and intention.</p>
          <a
            href="/exercises"
            className="inline-block text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            Complete today&apos;s daily brief &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

// ── Strategy Summary Types & Helpers ─────────────────────
interface ExerciseStatus {
  id: string;
  name: string;
  icon: string;
  completed: boolean;
}

interface BriefEntry {
  slug: string;
  title: string;
}

interface SummaryData {
  profile: string | null;
  grandStrategy: string | null;
  northStar: string | null;
  values: string | null;
  vision: string | null;
  currentWeek: string | null;
  exercises: ExerciseStatus[];
  recentBriefs: BriefEntry[];
}

function extractProfileFacts(content: string): string[] {
  const facts: string[] = [];
  const patterns = [
    /\*\*(?:Name|Age|Role|Location|Occupation|Career|Title)[:\s]*\*\*\s*(.+)/gi,
    /^[-\u2022]\s*\*\*(?:Name|Age|Role|Location|Occupation|Career|Title)[:\s]*\*\*\s*(.+)/gim,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      facts.push(match[0].trim());
    }
  }
  return facts.length > 0 ? facts.slice(0, 5) : [];
}

function extractIdentity(content: string): string | null {
  const match = content.match(/#+\s*(?:Core Identity|Identity|Who You Are)[^\n]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i);
  if (match) {
    const lines = match[1].trim().split('\n').filter((l) => l.trim()).slice(0, 3);
    return lines.join(' ').slice(0, 200);
  }
  return null;
}

function extractPreview(content: string, maxLen = 150): string {
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const text = lines.slice(0, 3).join(' ').replace(/\*\*/g, '').replace(/\*/g, '');
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function extractTiers(content: string): { tier: string; items: string[] }[] {
  const tiers: { tier: string; items: string[] }[] = [];
  const tierPattern = /#+\s*Tier\s+(\d+)[^\n]*\n([\s\S]*?)(?=\n#+\s*Tier|\n#+\s*[A-Z]|\n---|\s*$)/gi;
  let match;
  while ((match = tierPattern.exec(content)) !== null) {
    const tierNum = match[1];
    const body = match[2];
    const items = body
      .split('\n')
      .filter((l) => /^[-\u2022*]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim()))
      .map((l) => l.replace(/^[-\u2022*\d.]+\s*/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean)
      .slice(0, 5);
    if (items.length > 0) {
      tiers.push({ tier: `Tier ${tierNum}`, items });
    }
  }
  return tiers;
}

// ── Strategy Summary Cards ───────────────────────────────
function SummaryCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 ${className || ''}`}>
      <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}

function FoundationCard({
  title,
  content,
  exerciseLink,
}: {
  title: string;
  content: string | null;
  exerciseLink: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-xs text-zinc-500 font-medium mb-2">{title}</h4>
      {content ? (
        <p className="text-sm text-zinc-300">{extractPreview(content)}</p>
      ) : (
        <p className="text-sm text-zinc-600">
          Not yet defined &mdash;{' '}
          <a
            href={exerciseLink}
            className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
          >
            complete the exercise
          </a>
        </p>
      )}
    </div>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    // Seed records on first visit, then load records + strategy summary in parallel
    fetch('/api/seed', { method: 'POST' }).then(() => {
      Promise.all([
        fetch('/api/records').then((r) => r.json()),
        fetch('/api/strategy-summary').then((r) => r.json()),
      ]).then(([recordsData, summaryData]) => {
        setRecords(recordsData.records || []);
        setSummary(summaryData);
        setLoading(false);
      });
    });
  }, [session]);

  const grouped: Record<string, RecordRow[]> = {};
  for (const r of records) {
    if (!grouped[r.domain]) grouped[r.domain] = [];
    grouped[r.domain].push(r);
  }

  const profileRecord = records.find((r) => r.slug === 'biographical-profile');
  const strategyRecord = records.find((r) => r.slug === 'personal-grand-strategy');

  const profileTodos = useMemo(
    () => (profileRecord ? parseProfileTodos(profileRecord.content) : []),
    [profileRecord]
  );
  const strategyTodos = useMemo(
    () => (strategyRecord ? parseStrategyTodos(strategyRecord.content) : []),
    [strategyRecord]
  );

  // Parse custom reward menu from records
  const rewardMenuRecord = records.find((r) => r.slug === 'reward-menu');
  const customRewardMenu = useMemo<RewardMenu | null>(() => {
    if (!rewardMenuRecord) return null;
    // Try structured_data first
    if (rewardMenuRecord.structured_data) {
      try {
        const data = JSON.parse(rewardMenuRecord.structured_data);
        const rewards = data.structured_rewards || data;
        if (rewards.small && rewards.medium && rewards.large) {
          return rewards as RewardMenu;
        }
      } catch {}
    }
    // Fallback to markdown parsing
    return parseRewardsFromMarkdown(rewardMenuRecord.content);
  }, [rewardMenuRecord]);

  // Detect today's daily brief
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const dailyBriefComplete = records.some(
    (r) => r.record_type === 'daily-brief' && r.slug === today
  );

  // Use today's date as a seed so the reward changes daily but is stable within a day
  const daySeed = useMemo(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }, []);

  // Strategy summary derived data
  const profileFacts = useMemo(
    () => (summary?.profile ? extractProfileFacts(summary.profile) : []),
    [summary]
  );
  const identity = useMemo(
    () => (summary?.grandStrategy ? extractIdentity(summary.grandStrategy) : null),
    [summary]
  );
  const tiers = useMemo(
    () => (summary?.grandStrategy ? extractTiers(summary.grandStrategy) : []),
    [summary]
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-100 mb-6">Dashboard</h2>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <>
          {/* Todo Sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <DailyBriefStatus
              completed={dailyBriefComplete}
              rewardSeed={daySeed + 13}
              customRewards={customRewardMenu?.small}
            />
            {profileRecord && (
              <TodoSection
                title="Identity & Profile"
                todos={profileTodos}
                recordLink={`/records/${profileRecord.domain}/${profileRecord.slug}`}
                rewardSeed={daySeed}
                customRewards={customRewardMenu?.medium}
              />
            )}
            {strategyRecord && (
              <TodoSection
                title="Current Priorities"
                todos={strategyTodos}
                recordLink={`/records/${strategyRecord.domain}/${strategyRecord.slug}`}
                rewardSeed={daySeed + 7}
                customRewards={customRewardMenu?.medium}
              />
            )}
          </div>

          {/* Identity & Profile Summary */}
          {summary && (
            <>
              <SummaryCard title="Identity & Profile" className="mb-6">
                {summary.profile ? (
                  <div className="space-y-2">
                    {profileFacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {profileFacts.map((fact, i) => (
                          <span key={i} className="text-sm text-zinc-300">{fact}</span>
                        ))}
                      </div>
                    )}
                    {identity && <p className="text-sm text-zinc-400 mt-2">{identity}</p>}
                    {profileFacts.length === 0 && !identity && (
                      <p className="text-sm text-zinc-400">{extractPreview(summary.profile)}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Complete your biographical profile to see your overview.</p>
                )}
              </SummaryCard>

              {/* Strategic Foundation */}
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Strategic Foundation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FoundationCard
                    title="North Star"
                    content={summary.northStar}
                    exerciseLink="/exercises"
                  />
                  <FoundationCard
                    title="Values"
                    content={summary.values}
                    exerciseLink="/exercises"
                  />
                  <FoundationCard
                    title="Life Vision"
                    content={summary.vision}
                    exerciseLink="/exercises"
                  />
                </div>
              </div>

              {/* Current Priorities (Tiers) */}
              <SummaryCard title="Priority Tiers" className="mb-6">
                {tiers.length > 0 ? (
                  <div className="space-y-3">
                    {tiers.map((tier) => (
                      <div key={tier.tier}>
                        <p className="text-xs font-medium text-zinc-400 mb-1">{tier.tier}</p>
                        <ul className="space-y-1">
                          {tier.items.map((item, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <span className="text-zinc-600 mt-0.5">&bull;</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Complete your grand strategy to see priority tiers.</p>
                )}
              </SummaryCard>

              {/* Execution Pulse */}
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Execution Pulse</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <h4 className="text-xs text-zinc-500 font-medium mb-2">This Week</h4>
                    {summary.currentWeek ? (
                      <p className="text-sm text-zinc-300">{extractPreview(summary.currentWeek, 200)}</p>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        No weekly practice set.{' '}
                        <a href="/exercises" className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">
                          Start exercise
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <h4 className="text-xs text-zinc-500 font-medium mb-2">Recent Briefs</h4>
                    {summary.recentBriefs.length > 0 ? (
                      <ul className="space-y-1">
                        {summary.recentBriefs.map((brief) => (
                          <li key={brief.slug} className="text-sm text-zinc-400">{brief.slug}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        No daily briefs yet.{' '}
                        <a href="/exercises" className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">
                          Start exercise
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Exercise Progress */}
              <SummaryCard title="Exercise Progress" className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {summary.exercises.map((ex) => (
                    <a
                      key={ex.id}
                      href={ex.completed ? undefined : '/exercises'}
                      className={`flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                        ex.completed
                          ? 'text-zinc-300 cursor-default'
                          : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                        ex.completed
                          ? 'border-zinc-300 text-zinc-300'
                          : 'border-zinc-600'
                      }`}>
                        {ex.completed ? '✓' : ''}
                      </span>
                      <span className="text-sm truncate">{ex.icon} {ex.name}</span>
                    </a>
                  ))}
                </div>
              </SummaryCard>
            </>
          )}

          {/* Records Grid */}
          {records.length === 0 ? (
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
        </>
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
