/**
 * Parsing + display helpers for the Xelix configuration blocks produced by the
 * Configuration Agent (see app/api/agent-builder/chat/systemPrompt.ts).
 *
 * The agent replies conversationally and, when a configuration is settled,
 * appends a fenced ```json block. That block is the source of truth: it is what
 * gets stored on the agent when the operator applies it.
 */

export type XelixOutputType =
  | "send-emails"
  | "assign-users"
  | "assign-approvers"
  | "raise-invoices-as-exceptions"
  | "perform-workflow-actions"
  | "custom-field-extraction"
  | "custom-extraction-instructions"
  | "custom-classification"
  | "derive-value"
  | "derive-custom-field-value"
  | "split-or-merge-line-items"
  | "helpdesk-trigger"
  | "generated-reply-instructions"
  | "statement-trigger"
  | "statement-share-queue"
  | "transaction-classification"
  | "vendor-group"
  | "vendor-flagging-rule"
  | "report-chart"

export type XelixConfig = {
  outputType: XelixOutputType
  kind?: "rule" | "definition"
  summary?: string
  description?: string
  examples?: string[]
  mode?: "shadow" | "suggest" | "auto"
  conditions?: string[]
  actions?: string[]
  responseSubject?: string
  responseBody?: string
  instruction?: string
  target?: string
  reference?: string[]
  writesTo?: string
  items?: string[]
}

/** Module (sidebar stage) and operator-facing label for each supported output. */
export const OUTPUT_TYPE_META: Record<XelixOutputType, { stage: string; label: string }> = {
  "send-emails": { stage: "capture", label: "Send emails" },
  "assign-users": { stage: "capture", label: "Assign users" },
  "assign-approvers": { stage: "capture", label: "Assign approvers" },
  "raise-invoices-as-exceptions": { stage: "capture", label: "Raise as exception" },
  "perform-workflow-actions": { stage: "capture", label: "Workflow action" },
  "custom-field-extraction": { stage: "capture", label: "Custom field extraction" },
  "custom-extraction-instructions": { stage: "capture", label: "Custom extraction instructions" },
  "custom-classification": { stage: "capture", label: "Custom classification" },
  "derive-value": { stage: "capture", label: "Derive or calculate a value" },
  "derive-custom-field-value": { stage: "capture", label: "Derive a custom field value" },
  "split-or-merge-line-items": { stage: "capture", label: "Split or merge line items" },
  "helpdesk-trigger": { stage: "helpdesk", label: "Helpdesk trigger" },
  "generated-reply-instructions": { stage: "helpdesk", label: "Generated reply instructions" },
  "statement-trigger": { stage: "statements", label: "Statement trigger" },
  "statement-share-queue": { stage: "statements", label: "Auto-share statements" },
  "transaction-classification": { stage: "transactions", label: "Classification set" },
  "vendor-group": { stage: "vendors", label: "Vendor group" },
  "vendor-flagging-rule": { stage: "vendors", label: "Vendor review flag" },
  "report-chart": { stage: "reports", label: "Report chart" },
}

const OUTPUT_TYPES = Object.keys(OUTPUT_TYPE_META) as XelixOutputType[]

/** The supported outputs available in each module, as operator-facing labels. */
export const OUTPUT_LABELS_BY_STAGE: Record<string, string[]> = OUTPUT_TYPES.reduce(
  (acc, outputType) => {
    const { stage, label } = OUTPUT_TYPE_META[outputType]
    acc[stage] = [...(acc[stage] || []), label]
    return acc
  },
  {} as Record<string, string[]>,
)

/** Modules a configuration can belong to, for stage pickers. */
export const XELIX_MODULE_STAGES: { id: string; name: string }[] = [
  { id: "capture", name: "Xelix Capture" },
  { id: "helpdesk", name: "Helpdesk" },
  { id: "statements", name: "Statements" },
  { id: "transactions", name: "Transactions" },
  { id: "vendors", name: "Vendors" },
  { id: "reports", name: "Reports" },
]

function isOutputType(value: unknown): value is XelixOutputType {
  return typeof value === "string" && (OUTPUT_TYPES as string[]).includes(value)
}

/** Fenced code blocks, with or without a `json` language tag. */
const FENCED_BLOCK = /```[ \t]*(?:json)?[ \t]*\r?\n([\s\S]*?)```/gi

/**
 * Pull the configuration block out of an agent reply.
 * Returns the parsed config plus the exact text span it occupied, so the prose
 * reply can be shown without it. The last valid block wins — a follow-up turn
 * re-issues the full updated configuration.
 */
export function extractConfigBlock(response: string): { config: XelixConfig; blockText: string } | null {
  let found: { config: XelixConfig; blockText: string } | null = null

  for (const match of response.matchAll(FENCED_BLOCK)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue
    const candidate = parsed as Record<string, unknown>
    if (!isOutputType(candidate.outputType)) continue
    found = { config: candidate as XelixConfig, blockText: match[0] }
  }

  return found
}

/** The reply with the configuration block removed, for the chat bubble. */
export function stripConfigBlock(response: string, blockText: string): string {
  return response.replace(blockText, "").replace(/\n{3,}/g, "\n\n").trim()
}

/** What gets stored on the agent — the block itself, normalised. */
export function serialiseConfig(config: XelixConfig): string {
  return JSON.stringify(config, null, 2)
}

/** Read a stored agent prompt back as a configuration, if it is one. */
export function parseStoredConfig(prompt?: string | null): XelixConfig | null {
  if (!prompt) return null
  const trimmed = prompt.trim()
  if (!trimmed.startsWith("{")) return null
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    return isOutputType(parsed.outputType) ? (parsed as XelixConfig) : null
  } catch {
    return null
  }
}

/** Xelix rule modes map onto the agent's existing mode field. */
export function configAgentMode(config: XelixConfig): "observe" | "suggest" | "auto-apply" | undefined {
  switch (config.mode) {
    case "shadow":
      return "observe"
    case "suggest":
      return "suggest"
    case "auto":
      return "auto-apply"
    default:
      return undefined
  }
}

export function outputTypeLabel(outputType: XelixOutputType): string {
  return OUTPUT_TYPE_META[outputType]?.label ?? outputType
}

export function configStage(config: XelixConfig): string {
  return OUTPUT_TYPE_META[config.outputType]?.stage ?? "uncategorized"
}

const MODE_LABELS: Record<NonNullable<XelixConfig["mode"]>, string> = {
  shadow: "Shadow",
  suggest: "Suggest",
  auto: "Auto apply",
}

export function configModeLabel(config: XelixConfig): string | undefined {
  return config.mode ? MODE_LABELS[config.mode] : undefined
}

/** Ordered field list for rendering a configuration in the UI. */
export function configFields(config: XelixConfig): { label: string; values: string[] }[] {
  const fields: { label: string; values: string[] }[] = []

  const push = (label: string, value?: string | string[]) => {
    if (!value) return
    const values = (Array.isArray(value) ? value : [value]).filter((v) => typeof v === "string" && v.trim())
    if (values.length) fields.push({ label, values })
  }

  push("When", config.conditions)
  push("Then", config.actions)
  push("Instruction", config.instruction)
  push("Applies to", config.target)
  push("Reads from", config.reference)
  push("Writes to", config.writesTo)
  push("Values", config.items)
  push("Email subject", config.responseSubject)
  push("Email body", config.responseBody)
  push("Example", config.examples)

  return fields
}
