/** Known P2P / AP domain labels for sidebar + workflow sections */
export const STAGE_LABELS: Record<string, string> = {
  // Xelix modules — used by configurations built in Agent Builder 2
  capture: "Xelix Capture",
  helpdesk: "Helpdesk",
  statements: "Statements",
  transactions: "Transactions",
  vendors: "Vendors",
  reports: "Reports",
  // Legacy P2P stages — kept for existing agents
  procurement: "Procurement",
  receiving: "Goods Receiving",
  ingestion: "Invoice Import",
  "data-capture": "Data Capture",
  verification: "Verification",
  matching: "Matching",
  approval: "Approval",
  posting: "Posting",
  payments: "Payments",
  "vendor-management": "Vendor Management",
  compliance: "Compliance",
  uncategorized: "Uncategorized",
}

/** Preferred display order for known stages */
export const STAGE_ORDER = Object.keys(STAGE_LABELS)

export function getStageLabel(stageId: string): string {
  if (STAGE_LABELS[stageId]) return STAGE_LABELS[stageId]
  return stageId
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function normalizeStageId(stage?: string | null): string {
  const trimmed = (stage || "").trim().toLowerCase()
  return trimmed || "uncategorized"
}

type StageAgent = {
  stage: string
  active?: boolean
}

export type AgentsByStage<T extends StageAgent> = {
  id: string
  name: string
  agents: T[]
  activeCount: number
  inactiveCount: number
}

/**
 * Build left-panel / workflow sections from agents that exist.
 * Same stage id → same section; new stages appear automatically.
 */
export function groupAgentsByStage<T extends StageAgent>(agents: T[]): AgentsByStage<T>[] {
  const byStage = new Map<string, T[]>()

  for (const agent of agents) {
    const id = normalizeStageId(agent.stage)
    const list = byStage.get(id) || []
    list.push(agent)
    byStage.set(id, list)
  }

  const stageIds = Array.from(byStage.keys()).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a)
    const bi = STAGE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return getStageLabel(a).localeCompare(getStageLabel(b))
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return stageIds.map((id) => {
    const stageAgents = byStage.get(id) || []
    return {
      id,
      name: getStageLabel(id),
      agents: stageAgents,
      activeCount: stageAgents.filter((a) => a.active).length,
      inactiveCount: stageAgents.filter((a) => !a.active).length,
    }
  })
}
