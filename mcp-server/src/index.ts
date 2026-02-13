#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getUserByEmail,
  getRecords,
  getRecord,
  getRecordById,
  upsertRecord,
  getRecordVersions,
  searchRecords,
  getRecordsByTag,
  linkRecords,
  getLinkedRecords,
  getAgents,
  getAllRecordContentsForUser,
  getRecentActivity,
  getDomainSummary,
  getAnalytics,
  trackEvent,
  RecordRow,
} from './db.js';

// ── Exercise + Agent Definitions (inline for MCP) ──────────

const EXERCISES = [
  { id: 'ideal-self', name: 'Ideal Self / North Star', description: 'Envision your ideal self across 7 life domains', category: 'identity' },
  { id: 'obituary', name: 'Obituary', description: 'Write your own obituary as a legacy tool', category: 'identity' },
  { id: 'values-hierarchy', name: 'Values Hierarchy', description: 'Identify and rank your core values', category: 'identity' },
  { id: 'fear-inventory', name: 'Fear Inventory', description: 'Catalog fears and analyze their influence', category: 'identity' },
  { id: 'life-vision', name: 'Life Vision (3-5 Year)', description: 'Create a detailed day-in-the-life vision', category: 'strategy' },
  { id: 'legacy-letter', name: 'Legacy Letter', description: 'Write a letter about what matters most', category: 'identity' },
  { id: 'weekly-review', name: 'Weekly Review', description: 'Structured weekly reflection', category: 'review' },
  { id: 'daily-brief', name: 'Daily Brief', description: 'Start your day with clarity', category: 'review' },
  { id: 'saboteur-assessment', name: 'Saboteur Assessment', description: 'Identify your inner saboteurs', category: 'identity' },
  { id: 'strengths-assessment', name: 'Strengths Assessment', description: 'Discover your core strengths', category: 'identity' },
  { id: 'attachment-style', name: 'Attachment Style Reflection', description: 'Explore your attachment patterns', category: 'identity' },
  { id: 'belief-audit', name: 'Belief Audit', description: 'Examine core beliefs and which serve you', category: 'identity' },
  { id: 'relationship-map', name: 'Relationship Map', description: 'Map and assess key relationships', category: 'relationships' },
  { id: 'monthly-review', name: 'Monthly Review', description: 'Comprehensive monthly reflection', category: 'review' },
  { id: 'energy-audit', name: 'Energy Audit', description: 'Map energy patterns to optimize life', category: 'health' },
  { id: 'financial-snapshot', name: 'Financial Snapshot', description: 'Take stock of your financial life', category: 'finance' },
];

const BUILTIN_AGENTS = [
  { id: 'sun-tzu', name: 'Sun Tzu', tagline: 'Strategic positioning and patience', avatar: '🏯' },
  { id: 'machiavelli', name: 'Niccolò Machiavelli', tagline: 'Pragmatic power and political strategy', avatar: '🦊' },
  { id: 'marcus-aurelius', name: 'Marcus Aurelius', tagline: 'Stoic philosophy and self-discipline', avatar: '🏛️' },
  { id: 'clausewitz', name: 'Carl von Clausewitz', tagline: 'Decisive action and center of gravity', avatar: '⚔️' },
  { id: 'musashi', name: 'Miyamoto Musashi', tagline: 'Mastery through practice and adaptability', avatar: '⚡' },
];

const DOMAINS = [
  'strategy', 'assessment', 'goal', 'habit', 'health', 'journal',
  'finance', 'relationship', 'belief', 'project', 'exercise-output',
  'daily-brief', 'observation', 'note',
];

// ── User Resolution ────────────────────────────────────────

function resolveUserId(): number {
  const email = process.env.STRATEGY_KERNEL_USER_EMAIL;
  if (email) {
    const user = getUserByEmail(email);
    if (!user) {
      console.error(`[strategy-kernel] User not found for email: ${email}, falling back to user ID 1`);
      return 1;
    }
    return user.id;
  }
  return 1;
}

// ── Helper ─────────────────────────────────────────────────

function formatRecord(r: RecordRow): string {
  return `## ${r.title}\n- **Domain:** ${r.domain}\n- **Type:** ${r.record_type}\n- **Slug:** ${r.slug}\n- **Priority:** ${r.priority}\n- **Status:** ${r.status}\n- **Updated:** ${r.updated_at}\n\n${r.content}`;
}

function formatRecordBrief(r: RecordRow): string {
  return `- **${r.title}** (${r.domain}/${r.slug}) — priority ${r.priority}, updated ${r.updated_at}`;
}

// ── Server ─────────────────────────────────────────────────

const server = new McpServer({
  name: 'strategy-kernel',
  version: '1.0.0',
});

// ── Tool 1: list_records ───────────────────────────────────

server.tool(
  'list_records',
  'List records, optionally filtered by domain and status',
  {
    domain: z.string().optional().describe(`Filter by domain: ${DOMAINS.join(', ')}`),
    status: z.enum(['active', 'archived', 'draft']).optional().describe('Filter by status'),
    limit: z.number().optional().describe('Max records to return (default 100)'),
  },
  async ({ domain, status, limit }) => {
    const userId = resolveUserId();
    const records = getRecords(userId, { domain, status, limit });
    trackEvent(userId, 'mcp.list_records', { domain, count: records.length });

    if (records.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No records found.' }] };
    }

    const grouped: Record<string, RecordRow[]> = {};
    for (const r of records) {
      if (!grouped[r.domain]) grouped[r.domain] = [];
      grouped[r.domain].push(r);
    }

    let output = `# Records (${records.length} total)\n\n`;
    for (const [dom, recs] of Object.entries(grouped)) {
      output += `## ${dom}\n`;
      for (const r of recs) {
        output += formatRecordBrief(r) + '\n';
      }
      output += '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 2: read_record ────────────────────────────────────

server.tool(
  'read_record',
  'Read a specific record by domain and slug',
  {
    domain: z.string().describe('Record domain'),
    slug: z.string().describe('Record slug'),
  },
  async ({ domain, slug }) => {
    const userId = resolveUserId();
    const record = getRecord(userId, domain, slug);
    trackEvent(userId, 'mcp.read_record', { domain, slug });

    if (!record) {
      return { content: [{ type: 'text' as const, text: `Record not found: ${domain}/${slug}` }] };
    }

    let output = formatRecord(record);
    if (record.structured_data) {
      output += `\n\n### Structured Data\n\`\`\`json\n${record.structured_data}\n\`\`\``;
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 3: write_record ───────────────────────────────────

server.tool(
  'write_record',
  'Create or update a record. Automatically versions previous content on update.',
  {
    domain: z.string().describe(`Record domain: ${DOMAINS.join(', ')}`),
    record_type: z.string().describe('Subtype (e.g. quarterly-goal, sleep-log, saboteur-assessment)'),
    slug: z.string().describe('URL-friendly identifier'),
    title: z.string().describe('Record title'),
    content: z.string().describe('Markdown content'),
    structured_data: z.string().optional().describe('JSON string for domain-specific structured data'),
    priority: z.number().optional().describe('Priority 0-4 (4 = highest)'),
    status: z.enum(['active', 'archived', 'draft']).optional(),
    record_date: z.string().optional().describe('Date the record is about (YYYY-MM-DD)'),
    source_detail: z.string().optional().describe('Additional source context'),
  },
  async ({ domain, record_type, slug, title, content, structured_data, priority, status, record_date, source_detail }) => {
    const userId = resolveUserId();

    const record = upsertRecord(userId, {
      domain,
      record_type,
      slug,
      title,
      content,
      structured_data,
      source: 'mcp',
      source_detail,
      priority,
      status,
      record_date,
    });

    trackEvent(userId, 'mcp.write_record', { domain, slug, record_type });

    return {
      content: [{
        type: 'text' as const,
        text: `Record saved: ${record.domain}/${record.slug} (id: ${record.id})\nTitle: ${record.title}\nUpdated: ${record.updated_at}`,
      }],
    };
  }
);

// ── Tool 4: get_record_history ─────────────────────────────

server.tool(
  'get_record_history',
  'Get version history for a record',
  {
    domain: z.string().describe('Record domain'),
    slug: z.string().describe('Record slug'),
  },
  async ({ domain, slug }) => {
    const userId = resolveUserId();
    const record = getRecord(userId, domain, slug);

    if (!record) {
      return { content: [{ type: 'text' as const, text: `Record not found: ${domain}/${slug}` }] };
    }

    const versions = getRecordVersions(record.id);
    if (versions.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No previous versions found.' }] };
    }

    let output = `# Version History: ${record.title}\n\n`;
    output += `**Current version:** ${record.updated_at}\n\n`;
    for (const v of versions) {
      output += `---\n### Version from ${v.created_at}\n\n${v.content}\n\n`;
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 5: link_records ───────────────────────────────────

server.tool(
  'link_records',
  'Create a link between two records (the "reactor" part — cross-domain connections)',
  {
    source_domain: z.string().describe('Source record domain'),
    source_slug: z.string().describe('Source record slug'),
    target_domain: z.string().describe('Target record domain'),
    target_slug: z.string().describe('Target record slug'),
    link_type: z.string().optional().describe('Link type: related, supports, contradicts, derives-from, blocks'),
    note: z.string().optional().describe('Note about the relationship'),
  },
  async ({ source_domain, source_slug, target_domain, target_slug, link_type, note }) => {
    const userId = resolveUserId();
    const source = getRecord(userId, source_domain, source_slug);
    const target = getRecord(userId, target_domain, target_slug);

    if (!source) return { content: [{ type: 'text' as const, text: `Source record not found: ${source_domain}/${source_slug}` }] };
    if (!target) return { content: [{ type: 'text' as const, text: `Target record not found: ${target_domain}/${target_slug}` }] };

    linkRecords(source.id, target.id, link_type || 'related', note);
    trackEvent(userId, 'mcp.link_records', { source: `${source_domain}/${source_slug}`, target: `${target_domain}/${target_slug}`, link_type });

    return {
      content: [{
        type: 'text' as const,
        text: `Linked: ${source.title} → ${target.title} (${link_type || 'related'})`,
      }],
    };
  }
);

// ── Tool 6: search_records ─────────────────────────────────

server.tool(
  'search_records',
  'Full-text search across all records',
  {
    query: z.string().describe('Search query'),
    domain: z.string().optional().describe('Limit search to a specific domain'),
  },
  async ({ query, domain }) => {
    const userId = resolveUserId();
    const results = searchRecords(userId, query, domain);
    trackEvent(userId, 'mcp.search_records', { query, domain, count: results.length });

    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: `No results for: ${query}` }] };
    }

    let output = `# Search Results for "${query}" (${results.length} found)\n\n`;
    for (const r of results) {
      output += formatRecordBrief(r) + '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 7: get_records_by_tag ─────────────────────────────

server.tool(
  'get_records_by_tag',
  'Get all records with a specific tag',
  {
    tag: z.string().describe('Tag name'),
  },
  async ({ tag }) => {
    const userId = resolveUserId();
    const records = getRecordsByTag(userId, tag);

    if (records.length === 0) {
      return { content: [{ type: 'text' as const, text: `No records tagged: ${tag}` }] };
    }

    let output = `# Records tagged "${tag}" (${records.length})\n\n`;
    for (const r of records) {
      output += formatRecordBrief(r) + '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 8: get_linked_records ─────────────────────────────

server.tool(
  'get_linked_records',
  'Get all records linked to a specific record',
  {
    domain: z.string().describe('Record domain'),
    slug: z.string().describe('Record slug'),
  },
  async ({ domain, slug }) => {
    const userId = resolveUserId();
    const record = getRecord(userId, domain, slug);

    if (!record) {
      return { content: [{ type: 'text' as const, text: `Record not found: ${domain}/${slug}` }] };
    }

    const linked = getLinkedRecords(userId, record.id);
    if (linked.length === 0) {
      return { content: [{ type: 'text' as const, text: `No linked records for: ${record.title}` }] };
    }

    let output = `# Records linked to "${record.title}" (${linked.length})\n\n`;
    for (const r of linked) {
      output += formatRecordBrief(r) + '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 9: get_life_snapshot ──────────────────────────────

server.tool(
  'get_life_snapshot',
  'Get a comprehensive snapshot of all active records — ideal for starting any conversation with full context',
  {},
  async () => {
    const userId = resolveUserId();
    const records = getAllRecordContentsForUser(userId);
    trackEvent(userId, 'mcp.get_life_snapshot', { count: records.length });

    if (records.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No records yet. The user has not created any records in Strategy Kernel.' }] };
    }

    const grouped: Record<string, RecordRow[]> = {};
    for (const r of records) {
      if (!grouped[r.domain]) grouped[r.domain] = [];
      grouped[r.domain].push(r);
    }

    let output = `# Life Snapshot (${records.length} active records)\n\n`;
    for (const [dom, recs] of Object.entries(grouped)) {
      output += `## ${dom.toUpperCase()} (${recs.length} records)\n\n`;
      for (const r of recs) {
        output += `### ${r.title}\n`;
        output += `*${r.record_type} | priority ${r.priority} | updated ${r.updated_at}*\n\n`;
        output += r.content + '\n\n';
      }
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 10: get_domain_summary ────────────────────────────

server.tool(
  'get_domain_summary',
  'Get a summary of all records in a specific domain',
  {
    domain: z.string().describe(`Domain: ${DOMAINS.join(', ')}`),
  },
  async ({ domain }) => {
    const userId = resolveUserId();
    const summary = getDomainSummary(userId, domain);
    trackEvent(userId, 'mcp.get_domain_summary', { domain, count: summary.count });

    if (summary.count === 0) {
      return { content: [{ type: 'text' as const, text: `No active records in domain: ${domain}` }] };
    }

    let output = `# ${domain.toUpperCase()} Domain (${summary.count} records)\n\n`;
    for (const r of summary.records) {
      output += `### ${r.title}\n`;
      output += `*${r.record_type} | priority ${r.priority} | updated ${r.updated_at}*\n\n`;
      output += r.content + '\n\n---\n\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 11: get_recent_activity ───────────────────────────

server.tool(
  'get_recent_activity',
  'Get records updated recently',
  {
    days: z.number().optional().describe('Number of days to look back (default 7)'),
  },
  async ({ days }) => {
    const userId = resolveUserId();
    const records = getRecentActivity(userId, days || 7);
    trackEvent(userId, 'mcp.get_recent_activity', { days: days || 7, count: records.length });

    if (records.length === 0) {
      return { content: [{ type: 'text' as const, text: `No activity in the last ${days || 7} days.` }] };
    }

    let output = `# Recent Activity (last ${days || 7} days, ${records.length} records)\n\n`;
    for (const r of records) {
      output += formatRecordBrief(r) + '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 12: cross_domain_query ────────────────────────────

server.tool(
  'cross_domain_query',
  'Query records across multiple domains at once — the core "reactor" capability',
  {
    domains: z.array(z.string()).describe('List of domains to query'),
    include_content: z.boolean().optional().describe('Include full content (default false for brevity)'),
  },
  async ({ domains, include_content }) => {
    const userId = resolveUserId();
    const allRecords: RecordRow[] = [];

    for (const domain of domains) {
      const records = getRecords(userId, { domain, status: 'active' });
      allRecords.push(...records);
    }

    trackEvent(userId, 'mcp.cross_domain_query', { domains, count: allRecords.length });

    if (allRecords.length === 0) {
      return { content: [{ type: 'text' as const, text: `No records found in domains: ${domains.join(', ')}` }] };
    }

    let output = `# Cross-Domain Query: ${domains.join(', ')} (${allRecords.length} records)\n\n`;
    for (const r of allRecords) {
      if (include_content) {
        output += formatRecord(r) + '\n\n---\n\n';
      } else {
        output += formatRecordBrief(r) + '\n';
      }
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 13: list_exercises ────────────────────────────────

server.tool(
  'list_exercises',
  'List all available guided exercises',
  {},
  async () => {
    const grouped: Record<string, typeof EXERCISES> = {};
    for (const ex of EXERCISES) {
      if (!grouped[ex.category]) grouped[ex.category] = [];
      grouped[ex.category].push(ex);
    }

    let output = '# Available Exercises\n\n';
    for (const [cat, exs] of Object.entries(grouped)) {
      output += `## ${cat}\n`;
      for (const ex of exs) {
        output += `- **${ex.name}** (\`${ex.id}\`) — ${ex.description}\n`;
      }
      output += '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 14: list_advisors ─────────────────────────────────

server.tool(
  'list_advisors',
  'List all available advisors (builtin and custom)',
  {},
  async () => {
    const userId = resolveUserId();
    const customAgents = getAgents(userId);

    let output = '# Advisors\n\n## Builtin\n';
    for (const a of BUILTIN_AGENTS) {
      output += `- ${a.avatar} **${a.name}** — ${a.tagline}\n`;
    }

    if (customAgents.length > 0) {
      output += '\n## Custom\n';
      for (const a of customAgents) {
        output += `- ${a.avatar} **${a.name}** — ${a.tagline}\n`;
      }
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Tool 15: get_analytics ─────────────────────────────────

server.tool(
  'get_analytics',
  'Get analytics events for usage tracking',
  {
    event: z.string().optional().describe('Filter by event type'),
    since: z.string().optional().describe('ISO date to filter from'),
    limit: z.number().optional().describe('Max events to return (default 100)'),
  },
  async ({ event, since, limit }) => {
    const userId = resolveUserId();
    const events = getAnalytics(userId, { event, since, limit });

    if (events.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No analytics events found.' }] };
    }

    let output = `# Analytics (${events.length} events)\n\n`;
    for (const e of events) {
      output += `- **${e.event}** (${e.source}) — ${e.created_at}`;
      if (e.metadata) output += ` — ${e.metadata}`;
      output += '\n';
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// ── Resources ──────────────────────────────────────────────

// Static resources for core strategy docs
const CORE_RESOURCES = [
  { slug: 'biographical-profile', name: 'Biographical Profile' },
  { slug: 'personal-grand-strategy', name: 'Personal Grand Strategy' },
  { slug: 'current-week-practice', name: 'Current Week Practice' },
];

for (const res of CORE_RESOURCES) {
  server.resource(
    res.slug,
    `sk://records/strategy/${res.slug}`,
    { description: `Core strategy document: ${res.name}`, mimeType: 'text/markdown' },
    async () => {
      const userId = resolveUserId();
      const record = getRecord(userId, 'strategy', res.slug);
      return {
        contents: [{
          uri: `sk://records/strategy/${res.slug}`,
          mimeType: 'text/markdown',
          text: record ? record.content : `# ${res.name}\n\nNot yet created.`,
        }],
      };
    }
  );
}

// Dynamic resource template — register all active records as resources
// (The SDK doesn't have resourceTemplate, so we register known patterns as static resources)

// ── Start Server ───────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[strategy-kernel] MCP server running on stdio');
}

main().catch((err) => {
  console.error('[strategy-kernel] Fatal error:', err);
  process.exit(1);
});
