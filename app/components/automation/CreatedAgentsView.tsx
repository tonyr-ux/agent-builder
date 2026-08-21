"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react"
import styles from "./automation.module.css"
import { Badge, Button, StatusBadge } from "./ui"
import { OUTPUT_ICONS } from "./outputIcons"
import { outputGroup, outputTypeLabel, supportsMode } from "../agentbuilder/xelixConfig"
import { GROUP_ICONS } from "./outputIcons"
import { formatCreatedAt, loadAgents, type SavedAgent } from "./workspaceTypes"
import { PrototypeBanner } from "./PrototypeBanner"

const MODE_LABELS = { shadow: "Shadow", suggest: "Suggest", auto: "Auto apply" } as const

function AgentRow({ agent }: { agent: SavedAgent }) {
  const Icon = OUTPUT_ICONS[agent.config.outputType]
  const group = outputGroup(agent.config.outputType)
  const GroupIcon = GROUP_ICONS[group]
  const showMode = supportsMode(agent.config.outputType) && agent.config.mode
  // The name is taken from the config summary, so lead with the fuller description
  const blurb = agent.config.description ?? agent.config.summary

  return (
    <Link href={`/settings/automation?agent=${agent.id}`} className={styles.createdRow}>
      <span className={styles.createdMark} aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className={styles.createdMiddle}>
        <div className={styles.createdRowTop}>
          <span className={styles.createdName}>{agent.name}</span>
          <span className={styles.groupPill}>
            <GroupIcon size={11} aria-hidden="true" />
            {group}
          </span>
        </div>
        {blurb && <div className={[styles.createdSummary, styles.truncate].join(" ")}>{blurb}</div>}
        {agent.firstPrompt && (
          <div className={[styles.createdQuote, styles.truncate].join(" ")}>“{agent.firstPrompt}”</div>
        )}
        <div className={styles.createdMeta}>
          {outputTypeLabel(agent.config.outputType)} · Created {formatCreatedAt(agent.createdAt)} ·{" "}
          {agent.messages.length} {agent.messages.length === 1 ? "message" : "messages"}
        </div>
      </div>
      <div className={styles.createdRight}>
        {showMode && <Badge>{MODE_LABELS[agent.config.mode as keyof typeof MODE_LABELS]}</Badge>}
        <StatusBadge status={agent.live ? "live" : "off"} />
        <ChevronRight size={16} aria-hidden="true" />
      </div>
    </Link>
  )
}

export function CreatedAgentsView() {
  const [agents, setAgents] = useState<SavedAgent[] | null>(null)

  // localStorage is client-only, so the list resolves after mount
  useEffect(() => {
    setAgents(loadAgents())
  }, [])

  const count = agents?.length ?? 0

  return (
    <div className={styles.tokens}>
      <PrototypeBanner />
      <div className={[styles.createdPage, styles.createdInner].join(" ")}>
        <Link href="/settings/automation" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Agent Builder
        </Link>
        <h1 className={styles.createdTitle}>Active agents</h1>
        <p className={styles.createdSubtitle}>
          {agents === null
            ? "Loading…"
            : count === 0
              ? "Nothing accepted yet."
              : `${count} ${count === 1 ? "agent" : "agents"} accepted in the Agent Builder, ready to load into Xelix.`}
        </p>

        {agents !== null && count === 0 && (
          <div className={styles.createdEmpty}>
            <span className={styles.createdEmptyMark} aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className={styles.configEmptyTitle}>Nothing here yet</h2>
              <p className={styles.configEmptyBody}>
                Accepted agents land here, with the conversation that shaped them.
              </p>
            </div>
            <Link href="/settings/automation">
              <Button variant="outline">Build an agent</Button>
            </Link>
          </div>
        )}

        {agents !== null && count > 0 && (
          <div className={styles.createdList}>
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
