"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { Clock, History, MessagesSquare, Plus, RotateCcw, Send, Sparkles } from "lucide-react"
import styles from "./automation.module.css"
import { Button, StatusBadge } from "./ui"
import { MessageRow, ThinkingIndicator } from "./MessageItems"
import { OUTPUT_ICONS } from "./outputIcons"
import { outputTypeLabel, type XelixConfig } from "../agentbuilder/xelixConfig"
import { statsLine, type PendingAction, type SavedAgent, type WorkspaceMessage } from "./workspaceTypes"

const STICK_THRESHOLD = 80

function ChatHeader({
  agent,
  draftConfig,
  onNewAgent,
  onStartOver,
  onJumpToStart,
  onToggleActivity,
  activityOpen,
}: {
  agent: SavedAgent | null
  draftConfig: XelixConfig | null
  onNewAgent: () => void
  onStartOver: () => void
  onJumpToStart: () => void
  onToggleActivity: () => void
  activityOpen: boolean
}) {
  if (agent) {
    const Icon = OUTPUT_ICONS[agent.config.outputType]
    return (
      <header className={styles.chatHeader}>
        <div className={styles.chatHeaderInner}>
          <div className={styles.headerIdentity}>
            <span className={styles.headerMark} aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className={styles.headerText}>
              <div className={styles.headerKicker}>{outputTypeLabel(agent.config.outputType)}</div>
              <h2 className={styles.headerName}>{agent.name}</h2>
              <div className={styles.headerStats}>{statsLine(agent)}</div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="outline" onClick={onNewAgent}>
              <Plus size={14} aria-hidden="true" />
              New agent
            </Button>
            <Button variant="ghost" onClick={onJumpToStart} title="Jump to the start of this conversation">
              <MessagesSquare size={14} aria-hidden="true" />
              Chat history
            </Button>
            <Button variant="ghost" onClick={onToggleActivity} aria-expanded={activityOpen}>
              <History size={14} aria-hidden="true" />
              Activity
            </Button>
            <StatusBadge status={agent.live ? "live" : "off"} />
          </div>
        </div>
        {activityOpen && (
          <div className={styles.chatHeaderInner} style={{ marginTop: 12 }}>
            <p className={styles.headerStats}>
              {agent.appliedCount
                ? statsLine(agent)
                : "No activity yet. Xelix records runs once this agent is loaded and its conditions match."}
            </p>
          </div>
        )}
      </header>
    )
  }

  const draftName = draftConfig ? outputTypeLabel(draftConfig.outputType) : null

  return (
    <header className={styles.chatHeader}>
      <div className={styles.chatHeaderInner}>
        <div className={styles.headerIdentity}>
          <div className={styles.headerText}>
            <h2 className={styles.headerName}>{draftName ? `New ${draftName} use case` : "New agent"}</h2>
          </div>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge status="draft" />
          <Button variant="ghost" onClick={onStartOver}>
            <RotateCcw size={14} aria-hidden="true" />
            Start over
          </Button>
        </div>
      </div>
    </header>
  )
}

function EmptyState({ agentName }: { agentName: string | null }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyMark} aria-hidden="true">
        <Sparkles size={22} />
      </span>
      <h2 className={styles.emptyTitle}>
        {agentName ? `Set up a ${agentName} configuration` : "What could we automate?"}
      </h2>
      <p className={styles.emptyBody}>
        Let&apos;s explore it together. Tell me about a task in your AP workflow — I&apos;ll suggest what an agent
        could do, then shape and build it with you.
      </p>
      <Link href="/settings/automation/created" className={styles.quietLink}>
        <Clock size={14} aria-hidden="true" />
        Active agents
      </Link>
    </div>
  )
}

export function ChatPane({
  messages,
  agent,
  draftConfig,
  pending,
  latestQuestionId,
  latestEmailId,
  onSend,
  onAnswer,
  onDismissQuestion,
  onApplyEmail,
  onDiscardEmail,
  onNewAgent,
  onStartOver,
}: {
  messages: WorkspaceMessage[]
  agent: SavedAgent | null
  draftConfig: XelixConfig | null
  pending: PendingAction | null
  latestQuestionId: string | null
  latestEmailId: string | null
  onSend: (text: string) => void
  onAnswer: (messageId: string, answer: string) => void
  onDismissQuestion: (messageId: string) => void
  onApplyEmail: (messageId: string) => void
  onDiscardEmail: (messageId: string) => void
  onNewAgent: () => void
  onStartOver: () => void
}) {
  const [input, setInput] = useState("")
  const [activityOpen, setActivityOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickRef = useRef(true)

  const showHeader = !!agent || !!draftConfig
  const agentName = agent?.name ?? (draftConfig ? outputTypeLabel(draftConfig.outputType) : null)
  const thinking = !!pending

  // Only follow new content while the operator is already near the bottom
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node || !stickRef.current) return
    node.scrollTop = node.scrollHeight
  }, [messages, pending])

  useEffect(() => {
    if (!thinking) inputRef.current?.focus()
  }, [thinking])

  // Grow the composer with its content, up to the max-height in CSS
  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = "auto"
    node.style.height = `${node.scrollHeight}px`
  }, [input])

  const handleScroll = () => {
    const node = scrollRef.current
    if (!node) return
    stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_THRESHOLD
  }

  const submit = () => {
    const trimmed = input.trim()
    if (!trimmed || thinking) return
    setInput("")
    stickRef.current = true
    onSend(trimmed)
  }

  const placeholder = agent
    ? `Message the ${agent.name} to refine this agent…`
    : draftConfig
      ? `Describe what the ${outputTypeLabel(draftConfig.outputType)} should do…`
      : "Describe a task to automate, or ask what's possible…"

  return (
    <div className={styles.chatPane}>
      {showHeader && (
        <ChatHeader
          agent={agent}
          draftConfig={draftConfig}
          onNewAgent={onNewAgent}
          onStartOver={onStartOver}
          onJumpToStart={() => {
            stickRef.current = false
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
          }}
          onToggleActivity={() => setActivityOpen((prev) => !prev)}
          activityOpen={activityOpen}
        />
      )}

      <div className={styles.messageArea} ref={scrollRef} onScroll={handleScroll}>
        <div
          className={[styles.messageColumn, messages.length === 0 && !thinking ? styles.messageColumnCentred : ""]
            .filter(Boolean)
            .join(" ")}
        >
          {messages.length === 0 && !thinking && <EmptyState agentName={agentName} />}
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              interactiveQuestion={
                !!message.question &&
                message.id === latestQuestionId &&
                !message.question.answered &&
                !message.question.dismissed
              }
              canApplyEmail={
                !!message.email && message.id === latestEmailId && !message.email.applied && !message.email.discarded
              }
              onAnswer={(answer) => onAnswer(message.id, answer)}
              onDismissQuestion={() => onDismissQuestion(message.id)}
              onApplyEmail={() => onApplyEmail(message.id)}
              onDiscardEmail={() => onDiscardEmail(message.id)}
            />
          ))}
          {pending && <ThinkingIndicator label={pending.label} />}
        </div>
      </div>

      <div className={styles.composer}>
        <div className={styles.composerInner}>
          <div className={styles.composerPill}>
            <textarea
              ref={inputRef}
              className={styles.composerInput}
              rows={1}
              value={input}
              disabled={thinking}
              placeholder={placeholder}
              aria-label="Message the Configuration Agent"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
            <button
              type="button"
              className={[styles.sendButton, input.trim() && !thinking ? styles.sendButtonEnabled : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={!input.trim() || thinking}
              onClick={submit}
              aria-label="Send message"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </div>
          <p className={styles.composerHint}>Enter to send</p>
          <p className={[styles.prototypeNote, styles.prototypeNoteCentre].join(" ")}>
            This is a prototype only, it is not using any real data and is not built
          </p>
        </div>
      </div>
    </div>
  )
}
