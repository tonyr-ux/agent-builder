import { GroqService } from '@/lib/groq';
import { XELIX_CONFIG_AGENT_PROMPT } from './systemPrompt';
import type { ChatMessage } from '@/lib/groq';

export const maxDuration = 30;

const systemPrompt = XELIX_CONFIG_AGENT_PROMPT;

export async function POST(req: Request) {
  try {
    console.log("[v0] Chat API called");

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

    // Check if API key is configured
    if (!process.env.GROQ_API_KEY) {
      console.error("[v0] GROQ_API_KEY not found");
      return new Response(
        JSON.stringify({
          error: "Groq API key not configured. Please add GROQ_API_KEY to your environment variables.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Prepare messages with system prompt
    const chatMessages: ChatMessage[] = [
      { role: "system", content: contextualSystemPrompt },
      ...messages,
    ];

    console.log("[v0] Calling Groq API via service");

    // Use the GroqService for streaming
    const stream = await GroqService.createChatCompletionStream({
      messages: chatMessages,
      stream: true,
      temperature: 0.7,
      // Headroom for a prose reply plus a full configuration block (or a back-test);
      // a truncated block can't be parsed, so the operator would lose the Apply step
      max_tokens: 4096,
    });

    console.log("[v0] Streaming Groq response");

    return new Response(stream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[v0] Chat API error:", error);
    
    // Parse Groq-specific error messages for better user feedback
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for rate limit error
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      // Extract wait time if available (e.g., "3m41.184s")
      const waitTimeMatch = errorMessage.match(/try again in ([\d]+[msh.]+)/i);
      const waitTime = waitTimeMatch ? waitTimeMatch[1] : 'a few minutes';
      
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. You've reached Groq's daily token limit. Please try again in ${waitTime}.`,
          details: errorMessage,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
    
    // Check for authentication errors
    if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('authentication')) {
      return new Response(
        JSON.stringify({
          error: "Invalid API key. Please check your GROQ_API_KEY environment variable.",
          details: errorMessage,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    
    // Generic error fallback
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
