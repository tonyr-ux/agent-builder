import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * Session log for the Agents workspace (/settings/automation).
 *
 * POST records one turn — what the operator typed, the request sent to the model,
 * the raw completion, and what the UI parsed out of it. GET returns the log for the
 * hidden review page at /settings/automation/log.
 *
 * The route is unlinked rather than authenticated: anyone with the URL can read it,
 * so don't put anything in here you wouldn't share with everyone testing.
 */

/** Long enough for a full completion, short enough that one turn can't fill a row */
const MAX_TEXT = 40_000;
const MAX_JSON_CHARS = 200_000;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function clampText(value: unknown, limit = MAX_TEXT): string | null {
  if (typeof value !== 'string' || !value) return null;
  return value.length > limit ? `${value.slice(0, limit)}\n…[truncated]` : value;
}

function clampJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return undefined;
  if (encoded.length > MAX_JSON_CHARS) {
    return { truncated: true, bytes: encoded.length } as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sessionId = clampText(body.sessionId, 200);
    const userMessage = clampText(body.userMessage);
    if (!sessionId || !userMessage) {
      return Response.json({ error: 'sessionId and userMessage are required' }, { status: 400 });
    }

    await prisma.config_agent_session_events.create({
      data: {
        session_id: sessionId,
        turn_index: Number.isInteger(body.turnIndex) ? body.turnIndex : 0,
        action: clampText(body.action, 40) ?? 'build',
        model: clampText(body.model, 120),
        agent_name: clampText(body.agentName, 300),
        user_message: userMessage,
        request_json: clampJson(body.request) ?? {},
        current_config: clampJson(body.currentConfig),
        raw_response: clampText(body.rawResponse),
        parsed_json: clampJson(body.parsed),
        error: clampText(body.error, 2_000),
        duration_ms: Number.isInteger(body.durationMs) ? body.durationMs : null,
        user_agent: clampText(req.headers.get('user-agent'), 500),
      },
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    // Logging must never get in the way of the conversation
    console.error('[session-log] failed to record turn:', error);
    return Response.json({ error: 'Failed to record turn' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session');
    const requested = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const events = await prisma.config_agent_session_events.findMany({
      where: sessionId ? { session_id: sessionId } : undefined,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return Response.json(
      {
        exportedAt: new Date().toISOString(),
        count: events.length,
        limit,
        events,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[session-log] failed to read log:', error);
    return Response.json(
      { error: 'Failed to read the log. Is DATABASE_URL set and migration 206 applied?' },
      { status: 500 },
    );
  }
}
