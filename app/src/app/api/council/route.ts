import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chatOnce } from '@/lib/claude';
import { getAllRecordContentsForUser, getAgents, trackEvent } from '@/lib/db';
import { BUILTIN_AGENTS, getBuiltinAgent } from '@/lib/agents';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const userId = parseInt(session.user.id);
  const { agentIds, topic } = (await req.json()) as { agentIds: string[]; topic: string };

  if (!agentIds?.length || !topic) {
    return new Response('Missing agentIds or topic', { status: 400 });
  }

  const records = getAllRecordContentsForUser(userId);
  const recordsContext = records
    .map((r) => `--- ${r.domain}/${r.slug} ---\n${r.content}`)
    .join('\n\n');

  const customAgents = getAgents(userId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const transcript: Array<{ name: string; response: string }> = [];

      for (const agentId of agentIds) {
        const builtin = getBuiltinAgent(agentId);
        const custom = customAgents.find((a) => String(a.id) === agentId);
        const agent = builtin || (custom ? { name: custom.name, avatar: custom.avatar, system_prompt: custom.system_prompt } : null);

        if (!agent) continue;

        const priorContext = transcript
          .map((t) => `${t.name} said:\n${t.response}`)
          .join('\n\n');

        const systemPrompt = `${agent.system_prompt}\n\nHere are the user's strategy records:\n\n${recordsContext}\n\n${
          priorContext ? `Previous council members have spoken:\n\n${priorContext}\n\nBuild on or challenge what they said.` : ''
        }`;

        controller.enqueue(encoder.encode(`\n\n### ${agent.name}\n\n`));

        try {
          const response = await chatOnce(systemPrompt, [{ role: 'user', content: topic }]);
          transcript.push({ name: agent.name, response });
          controller.enqueue(encoder.encode(response));
        } catch (err: any) {
          controller.enqueue(encoder.encode(`[Error: ${err.message}]`));
        }
      }

      // Moderator synthesis
      if (transcript.length >= 2) {
        controller.enqueue(encoder.encode('\n\n### Moderator Synthesis\n\n'));
        const synthPrompt = `You are a neutral moderator synthesizing a council debate. The topic was: "${topic}"\n\nHere's what each advisor said:\n\n${transcript.map((t) => `**${t.name}:**\n${t.response}`).join('\n\n')}\n\nSynthesize the key points of agreement, disagreement, and recommend a path forward.`;

        try {
          const synthesis = await chatOnce(synthPrompt, [{ role: 'user', content: 'Please synthesize.' }]);
          controller.enqueue(encoder.encode(synthesis));
        } catch (err: any) {
          controller.enqueue(encoder.encode(`[Error: ${err.message}]`));
        }
      }

      trackEvent(userId, 'council.debate', 'web', { agentIds, topic });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
