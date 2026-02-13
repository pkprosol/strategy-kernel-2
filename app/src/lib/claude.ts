import Anthropic from '@anthropic-ai/sdk';
import { getAllRecordContentsForUser, RecordRow } from './db';
import { getExercise } from './exercises';
import { getBuiltinAgent, BUILTIN_AGENTS } from './agents';

const anthropic = new Anthropic();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatContext =
  | { type: 'mode'; mode: 'strategy' | 'evolve' | 'daily-brief' | 'review' }
  | { type: 'exercise'; exerciseId: string }
  | { type: 'advisor'; agentId: string }
  | { type: 'custom-agent'; agentId: number; systemPrompt: string }
  | { type: 'agent-builder' };

function formatRecordsForContext(records: RecordRow[]): string {
  if (records.length === 0) return 'No records yet.';
  return records
    .map((r) => `--- ${r.domain}/${r.slug} (${r.record_type}) ---\n${r.content}`)
    .join('\n\n');
}

function buildSystemPrompt(context: ChatContext, records: RecordRow[]): string {
  const recordsContext = formatRecordsForContext(records);
  const base = `You are an AI assistant embedded in Strategy Kernel, a personal data reactor for life strategy. You have access to the user's records across domains: strategy, assessment, goals, habits, health, journal, finance, relationships, beliefs, and more.\n\nHere are the user's current records:\n\n${recordsContext}\n\n`;

  switch (context.type) {
    case 'mode':
      switch (context.mode) {
        case 'strategy':
          return base + `You are in STRATEGY mode. Help the user think about high-level life strategy, priorities, goals, and direction. Reference their existing records. Be direct, insightful, and challenge their thinking when appropriate. Help them see connections across domains.`;
        case 'evolve':
          return base + `You are in EVOLVE mode. Help the user with personal growth, self-awareness, and behavior change. Be empathetic but honest. Reference their assessments, beliefs, and patterns. Help them identify blind spots and growth edges.`;
        case 'daily-brief':
          return base + `You are facilitating a DAILY BRIEF. Help the user start their day with clarity. Review their priorities, check in on energy and mood, and set intentions. Keep it focused and action-oriented (5-10 minutes).`;
        case 'review':
          return base + `You are facilitating a REVIEW session. Help the user reflect on recent activity, assess progress on goals, identify patterns, and make adjustments. Reference their recent records and activity.`;
      }
      break;

    case 'exercise': {
      const exercise = getExercise(context.exerciseId);
      if (!exercise) return base + 'Unknown exercise.';
      return base + exercise.system_prompt;
    }

    case 'advisor': {
      const agent = getBuiltinAgent(context.agentId);
      if (!agent) return base + 'Unknown advisor.';
      return base + agent.system_prompt;
    }

    case 'custom-agent':
      return base + context.systemPrompt;

    case 'agent-builder':
      return base + `You are helping the user create a custom AI advisor for their Strategy Kernel. Guide them through defining:
1. Name and avatar (emoji)
2. Role and expertise
3. Tagline (one line)
4. Communication style and tone
5. Core principles (3-5)
6. How they should advise

When they're satisfied with the design, output ONLY a JSON object:
{"agent_complete": true, "name": "...", "description": "...", "tagline": "...", "system_prompt": "...", "avatar": "emoji"}`;
  }

  return base;
}

export async function* streamChat(
  userId: number,
  context: ChatContext,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const records = getAllRecordContentsForUser(userId);
  const systemPrompt = buildSystemPrompt(context, records);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

export async function chatOnce(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
