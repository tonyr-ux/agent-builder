import { AnthropicService } from '@/lib/anthropic';
import { anthropicConfig } from '@/lib/anthropic/config';
import { XELIX_CONFIG_AGENT_PROMPT } from './systemPrompt';
import type { AnthropicMessage } from '@/lib/anthropic/types';

export const maxDuration = 60;

const systemPrompt = XELIX_CONFIG_AGENT_PROMPT;

type IncomingMessage = { role?: string; content?: unknown };

/**
 * The chat UI seeds the transcript with an assistant greeting, and Claude
 * requires the first message to be from the user. Drop any leading assistant
 * turns and skip empty content, which the API also rejects.
 */
function toAnthropicMessages(messages: IncomingMessage[]): AnthropicMessage[] {
  const usable = messages.filter(
    (msg): msg is { role: 'user' | 'assistant'; content: string } =>
      (msg?.role === 'user' || msg?.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0,
  );

  const firstUser = usable.findIndex((msg) => msg.role === 'user');
  if (firstUser === -1) return [];

  return usable.slice(firstUser).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Re-shape Claude's event stream into the OpenAI-style SSE frames the chat
 * interface already parses (`data: {choices:[{delta:{content}}]}` + [DONE]).
 */
function toChatSSE(stream: AsyncIterable<any>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendText = (content: string) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );

      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            sendText(event.delta.text);
            continue;
          }

          // A truncated configuration block can't be parsed into an Apply step,
          // and a refusal arrives as a normal 200 - say so rather than letting
          // the reply just stop mid-sentence.
          if (event.type === 'message_delta') {
            const stopReason = event.delta?.stop_reason;
            if (stopReason === 'max_tokens') {
              sendText('\n\n_The reply hit the output limit and was cut short. Ask me to continue._');
            } else if (stopReason === 'refusal') {
              sendText('\n\n_I stopped short of answering that one. Try rephrasing the request._');
            }
          }
        }
      } catch (error) {
        console.error('[agent-builder] Stream interrupted:', error);
        sendText('\n\n_The connection dropped part-way through. Please send that again._');
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { messages, currentPrompt, agentName } = await req.json();

    // Determine if we're in edit mode (existing configuration) or creation mode
    const isEditMode = !!currentPrompt && currentPrompt.length > 0;

    // Give the agent the configuration it is currently editing
    let contextualSystemPrompt = systemPrompt;

    if (isEditMode) {
      contextualSystemPrompt += `\n\n=== CURRENT CONFIGURATION ===
The operator already has a saved configuration open and is asking for changes to it.

NAME: ${agentName || 'Untitled configuration'}

SAVED CONFIGURATION:
\`\`\`
${currentPrompt}
\`\`\`

How to handle changes:
- Treat the operator's message as a change to THIS configuration, not a new one.
- Keep the same outputType unless the change genuinely belongs to a different supported output; if it
  does, say so plainly and explain why before proposing it.
- Change only what they asked for and carry every other field through unchanged.
- Re-issue the FULL updated configuration block, and confirm what you changed in one sentence.
- For a wording change to a Send emails configuration, also show the full updated subject and body in
  your reply.
- If the change is genuinely ambiguous, ask one focused question instead and don't output a block.`;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[agent-builder] ANTHROPIC_API_KEY not found');
      return new Response(
        JSON.stringify({
          error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const chatMessages = toAnthropicMessages(Array.isArray(messages) ? messages : []);

    if (chatMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No message to respond to.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const stream = await AnthropicService.createChatStream({
      messages: chatMessages,
      system: contextualSystemPrompt,
    });

    return new Response(toChatSSE(stream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[agent-builder] Chat API error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = typeof error?.status === 'number' ? error.status : undefined;

    if (status === 401 || status === 403) {
      return new Response(
        JSON.stringify({
          error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.',
          details: errorMessage,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (status === 429) {
      const retryAfter = error?.headers?.['retry-after'];
      return new Response(
        JSON.stringify({
          error: retryAfter
            ? `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
            : 'Rate limit exceeded. Please try again in a few minutes.',
          details: errorMessage,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (status === 404) {
      return new Response(
        JSON.stringify({
          error: `Model "${anthropicConfig.chat.model}" is not available to this API key.`,
          details: errorMessage,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        details: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
