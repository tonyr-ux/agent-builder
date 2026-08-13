"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ClipboardCheck, Sparkles } from "lucide-react"
import styles from "./automation.module.css"
import { Badge, Bullets, Button, Checklist, Disclosure, Row, Section, Segmented, StatusBadge, Switch } from "./ui"
import { GROUP_ICONS, OUTPUT_ICONS } from "./outputIcons"
import {
  type XelixConfig,
  isTriggerOutput,
  outputGroup,
  outputTypeLabel,
  supportsMode,
} from "../agentbuilder/xelixConfig"

const MODE_OPTIONS = [
  { value: "shadow" as const, label: "Shadow" },
  { value: "suggest" as const, label: "Suggest" },
  { value: "auto" as const, label: "Auto apply" },
]

const MODE_HELP: Record<NonNullable<XelixConfig["mode"]>, string> = {
  shadow: "Runs quietly and logs what it would have done, without acting.",
  suggest: "Proposes each action for someone to approve before it runs.",
  auto: "Acts automatically as soon as the conditions match.",
}

/** Derived "how it works" steps for rules and non-trigger definitions. */
function derivedSteps(config: XelixConfig): string[] {
  const steps: string[] = []

  if (config.conditions?.length) {
    steps.push(`Watches for: ${config.conditions.join("; ")}`)
  }
  if (config.instruction) {
    steps.push(config.instruction)
  }
  if (config.actions?.length) {
    config.actions.forEach((action) => steps.push(action))
  }
  if (config.responseSubject) {
    steps.push(`Sends the email "${config.responseSubject}"`)
  }
  if (config.writesTo) {
    steps.push(`Writes the result to ${config.writesTo}`)
  }
  if (!steps.length && config.description) {
    steps.push(config.description)
  }
  return steps
}

function TriggerSections({ config }: { config: XelixConfig }) {
  return (
    <>
      <Section label="When">
        {config.conditions?.length ? (
          <Bullets items={config.conditions} />
        ) : (
          <span className={styles.emptyNote}>No conditions set yet</span>
        )}
      </Section>
      <Section label="Then">
        {config.actions?.length ? (
          <Bullets items={config.actions} />
        ) : (
          <span className={styles.emptyNote}>No actions set yet</span>
        )}
      </Section>
    </>
  )
}

function DefinitionSections({ config }: { config: XelixConfig }) {
  const destinationLabel =
    config.outputType === "custom-extraction-instructions"
      ? "Refines"
      : config.outputType === "generated-reply-instructions"
        ? "Applies to"
        : "Writes to"
  const destination = config.writesTo || config.target

  return (
    <>
      {config.instruction && (
        <Section label="Instruction">
          <div className={styles.quietInset}>{config.instruction}</div>
        </Section>
      )}
      {!!config.reference?.length && (
        <Section>
          <Row label="Reads from" value={config.reference.join(", ")} />
        </Section>
      )}
      {destination && (
        <Section>
          <Row label={destinationLabel} value={destination} />
        </Section>
      )}
    </>
  )
}

function OutputSections({
  config,
  onPreviewEmail,
  editable,
}: {
  config: XelixConfig
  onPreviewEmail?: () => void
  editable: boolean
}) {
  if (isTriggerOutput(config.outputType)) {
    return <TriggerSections config={config} />
  }

  if (config.outputType === "transaction-classification") {
    return (
      <>
        <Section>
          <Row label="Applies to" value={config.target ?? "Not set"} />
        </Section>
        <Section label="Options">
          {config.items?.length ? (
            <Bullets items={config.items} />
          ) : (
            <span className={styles.emptyNote}>No options set yet</span>
          )}
        </Section>
      </>
    )
  }

  if (config.outputType === "vendor-group") {
    return (
      <>
        <Section>
          <Row label="Group" value={config.target ?? "Not set"} />
        </Section>
        <Section label="Members">
          {config.items?.length ? (
            <Bullets items={config.items} />
          ) : (
            <span className={styles.emptyNote}>No members set yet</span>
          )}
        </Section>
      </>
    )
  }

  if (config.outputType === "report-chart") {
    return (
      <Section>
        <Row label="Chart" value={config.target ?? "Untitled"} />
        {config.instruction && <Row label="Plots" value={config.instruction} />}
        {!!config.reference?.length && <Row label="Based on" value={config.reference.join(", ")} />}
      </Section>
    )
  }

  if (config.kind === "definition") {
    return <DefinitionSections config={config} />
  }

  const steps = derivedSteps(config)

  return (
    <>
      {steps.length > 0 && (
        <Section label="How it works">
          <Checklist steps={steps} />
        </Section>
      )}
      {config.outputType === "send-emails" && (
        <Section>
          <Row
            label="Response"
            value={
              <span>
                {config.responseSubject ? "Email template" : "No template yet"}
                {onPreviewEmail && (
                  <>
                    {" "}
                    <Button variant="ghost" onClick={onPreviewEmail}>
                      Preview
                    </Button>
                    {editable && (
                      <Button variant="ghost" onClick={onPreviewEmail}>
                        {config.responseSubject ? "Change" : "Choose"}
                      </Button>
                    )}
                  </>
                )}
              </span>
            }
          />
        </Section>
      )}
    </>
  )
}

function GeneratingBody() {
  return (
    <>
      <div className={styles.hero}>
        <span className={[styles.heroTile, styles.heroTilePulsing].join(" ")} aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>Building agent…</span>
        </div>
      </div>
      {["Output", "Examples", "Workflow"].map((label) => (
        <div key={label} className={styles.skeletonRow}>
          <div className={styles.skeletonLabel}>{label}</div>
          <div className={styles.shimmer} />
          <div className={[styles.shimmer, styles.shimmerShort].join(" ")} />
        </div>
      ))}
    </>
  )
}

export function ConfigCard({
  highlightNonce,
  config,
  generating,
  saved,
  live,
  editable,
  backTestDisabled,
  onModeChange,
  onToggleLive,
  onAccept,
  onRunBackTest,
  onPreviewEmail,
}: {
  /** Increment to flash the card, e.g. when the operator clicks the chat cue */
  highlightNonce?: number
  config: XelixConfig | null
  generating: boolean
  saved: boolean
  live: boolean
  editable: boolean
  backTestDisabled: boolean
  onModeChange: (mode: NonNullable<XelixConfig["mode"]>) => void
  onToggleLive: (next: boolean) => void
  onAccept: () => void
  onRunBackTest: () => void
  onPreviewEmail: () => void
}) {
  const [flashing, setFlashing] = useState(false)
  const seenNonce = useRef(highlightNonce ?? 0)

  useEffect(() => {
    const nonce = highlightNonce ?? 0
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    setFlashing(true)
    const timer = window.setTimeout(() => setFlashing(false), 900)
    return () => window.clearTimeout(timer)
  }, [highlightNonce])

  const title = saved ? "Configuration" : "Proposed configuration"
  const status = generating ? (config ? "updating" : "building") : saved ? (live ? "live" : "off") : "draft"

  const OutputIcon = config ? OUTPUT_ICONS[config.outputType] : Sparkles
  const group = config ? outputGroup(config.outputType) : null
  const GroupIcon = group ? GROUP_ICONS[group] : null
  const showMode = config ? supportsMode(config.outputType) : false
  const mode = config?.mode ?? "suggest"

  return (
    <div className={[styles.configCard, flashing ? styles.configCardHighlight : ""].filter(Boolean).join(" ")}>
      <div className={styles.configHead}>
        <h2 className={styles.configTitle}>{title}</h2>
        <div className={styles.configHeadRight}>
          <StatusBadge status={status} />
          {saved && editable && <Switch checked={live} onChange={onToggleLive} label="Agent enabled" />}
        </div>
      </div>

      {!config && !generating && (
        <div className={styles.configEmpty}>
          <span className={styles.configEmptyMark} aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <h3 className={styles.configEmptyTitle}>No configuration yet</h3>
          <p className={styles.configEmptyBody}>
            Describe a task in the chat and it&apos;ll take shape here as a proposed configuration.
          </p>
        </div>
      )}

      {!config && generating && <GeneratingBody />}

      {config && (
        <>
          <div className={styles.hero}>
            <span className={styles.heroTile} aria-hidden="true">
              <OutputIcon size={20} />
            </span>
            <div className={styles.heroText}>
              <div className={styles.heroTop}>
                <span className={styles.heroLabel}>{outputTypeLabel(config.outputType)}</span>
                {group && GroupIcon && (
                  <span className={styles.groupPill}>
                    <GroupIcon size={11} aria-hidden="true" />
                    {group}
                  </span>
                )}
              </div>
              {config.summary && <p className={styles.heroSummary}>{config.summary}</p>}
            </div>
          </div>

          <OutputSections config={config} onPreviewEmail={onPreviewEmail} editable={editable} />

          {showMode && (
            <Section label="Mode">
              <Segmented
                label="Mode"
                options={MODE_OPTIONS}
                value={mode}
                disabled={!editable}
                onChange={onModeChange}
              />
              <p className={styles.segmentHelp}>{MODE_HELP[mode]}</p>
            </Section>
          )}

          {!!config.examples?.length && (
            <Disclosure summary="Examples">
              <Bullets items={config.examples} />
            </Disclosure>
          )}

          {editable && (
            <div className={styles.backTestBlock}>
              <div className={styles.backTestHead}>
                <ClipboardCheck size={16} aria-hidden="true" />
                <span className={styles.backTestLabel}>Back-test</span>
                <Badge>Historic data</Badge>
              </div>
              <p className={styles.backTestCopy}>
                Replay recent invoices to see what this configuration would have done — the results appear in the
                chat. Nothing leaves Xelix.
              </p>
              <Button variant="outline" full disabled={backTestDisabled} onClick={onRunBackTest}>
                Run back-test
              </Button>
            </div>
          )}

          {!saved && (
            <div className={styles.configFooter}>
              <Button variant="gradient" full onClick={onAccept}>
                <CheckCircle2 size={18} aria-hidden="true" />
                Accept &amp; go live
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
