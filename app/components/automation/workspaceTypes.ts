import type { XelixConfig } from "../agentbuilder/xelixConfig"
import type { ParsedBackTest, ParsedEmail, ParsedQuestion } from "./parseReply"

export type WorkspaceMessage = {
  id: string
  role: "user" | "assistant"
  /** Prose shown in the bubble, with any parsed block removed */
  content: string
  question?: ParsedQuestion & { answered?: boolean; dismissed?: boolean }
  email?: ParsedEmail & { applied?: boolean; discarded?: boolean }
  backTest?: ParsedBackTest
  /** Shows the "ready in the Builder" cue beneath this message */
  configReady?: boolean
}

export type SavedAgent = {
  id: string
  name: string
  config: XelixConfig
  /** ISO timestamp */
  createdAt: string
  live: boolean
  /** The operator's opening message, quoted on the created list */
  firstPrompt: string
  messages: WorkspaceMessage[]
  /** Real activity only — Xelix records runs, this workspace never invents them */
  appliedCount: number
  lastRunAt?: string
}

export type ThinkingLabel = "Building agent" | "Loading preview" | "Running back-test"

/** What the current in-flight request is for, so replies are parsed accordingly */
export type PendingAction = {
  label: ThinkingLabel
  kind: "build" | "preview" | "backtest"
}

const STORAGE_KEY = "xelix.automation.agents"

function isSavedAgent(value: unknown): value is SavedAgent {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<SavedAgent>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    !!candidate.config &&
    typeof candidate.config === "object" &&
    typeof candidate.createdAt === "string"
  )
}

export function loadAgents(): SavedAgent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedAgent)
  } catch {
    return []
  }
}

export function saveAgent(agent: SavedAgent): SavedAgent[] {
  const existing = loadAgents()
  const next = existing.some((item) => item.id === agent.id)
    ? existing.map((item) => (item.id === agent.id ? agent : item))
    : [agent, ...existing]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked — the session still works, it just won't persist
  }
  return next
}

export function findAgent(id: string): SavedAgent | null {
  return loadAgents().find((agent) => agent.id === id) ?? null
}

/** "3 Feb 14:05" — the created list's meta line */
export function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Honest stats line: no invented run history. */
export function statsLine(agent: SavedAgent): string {
  const created = `Created ${formatCreatedAt(agent.createdAt)}`
  if (!agent.appliedCount) {
    return `${created} · not applied yet`
  }
  const times = agent.appliedCount === 1 ? "Applied once" : `Applied ${agent.appliedCount} times`
  const lastRun = agent.lastRunAt ? ` · last run ${formatCreatedAt(agent.lastRunAt)}` : ""
  return `${times}${lastRun}`
}
