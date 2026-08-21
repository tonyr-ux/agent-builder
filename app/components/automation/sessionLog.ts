/**
 * Records each turn of the workspace to /api/agent-builder/log for review at
 * /settings/automation/log. Fire-and-forget: a logging failure must never
 * interrupt the conversation, so everything here swallows its errors.
 */

const SESSION_KEY = "xelix.automation.sessionId"

/** One id per browser tab-series, so a tester's turns read in order */
export function sessionId(): string {
  if (typeof window === "undefined") return "server"
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    window.localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return "unknown"
  }
}

export type TurnLog = {
  turnIndex: number
  action: string
  agentName?: string
  userMessage: string
  /** The transcript posted to the model */
  request: unknown
  currentConfig?: unknown
  /** The completion exactly as returned, before parsing */
  rawResponse?: string
  /** What the UI made of it */
  parsed?: unknown
  error?: string
  durationMs?: number
}

export function recordTurn(entry: TurnLog): void {
  if (typeof window === "undefined") return
  try {
    void fetch("/api/agent-builder/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId(), ...entry }),
      keepalive: true,
    }).catch(() => {
      // Nothing to do — the log is best-effort
    })
  } catch {
    // Same
  }
}
