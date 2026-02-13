import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { streamChat, ChatContext, ChatMessage } from '@/lib/claude';
import { trackEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const { context, messages } = (await req.json()) as {
    context: ChatContext;
    messages: ChatMessage[];
  };

  trackEvent(userId, 'chat.message', 'web', { contextType: context.type });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(userId, context, messages)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${err.message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
