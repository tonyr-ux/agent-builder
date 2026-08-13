"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ChevronRight, MinusCircle, Sparkles, User } from "lucide-react"
import styles from "./automation.module.css"
import { Badge, Button } from "./ui"
import { toRichBlocks } from "./parseReply"
import type { WorkspaceMessage } from "./workspaceTypes"

/** Light markdown: paragraphs, bullets and bold. */
export function RichText({ text }: { text: string }) {
  const blocks = toRichBlocks(text)
  return (
    <div className={styles.messageText}>
      {blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index}>
            {block.spans.map((span, spanIndex) =>
              span.bold ? <strong key={spanIndex}>{span.text}</strong> : <span key={spanIndex}>{span.text}</span>,
            )}
          </p>
        ) : (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {item.map((span, spanIndex) =>
                  span.bold ? <strong key={spanIndex}>{span.text}</strong> : <span key={spanIndex}>{span.text}</span>,
                )}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

export function QuestionCard({
  question,
  interactive,
  onAnswer,
  onDismiss,
}: {
  question: NonNullable<WorkspaceMessage["question"]>
  interactive: boolean
  onAnswer: (answer: string) => void
  onDismiss: () => void
}) {
  const [other, setOther] = useState("")

  const submitOther = () => {
    const trimmed = other.trim()
    if (!trimmed) return
    setOther("")
    onAnswer(trimmed)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.cardPrompt}>{question.prompt}</p>
        {interactive && (
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
      <div className={styles.options}>
        {question.options.map((option, index) => (
          <button
            key={option}
            type="button"
            className={styles.option}
            disabled={!interactive}
            onClick={() => onAnswer(option)}
          >
            <span className={styles.optionNumber} aria-hidden="true">
              {index + 1}
            </span>
            <span>{option}</span>
          </button>
        ))}
      </div>
      {interactive && (
        <div className={styles.cardFoot}>
          <input
            className={styles.bareInput}
            placeholder="Something else…"
            value={other}
            aria-label="Something else"
            onChange={(event) => setOther(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submitOther()
              }
            }}
          />
          <Button variant="ghost" onClick={() => onAnswer("Skip — use your best judgement.")}>
            Skip
          </Button>
        </div>
      )}
    </div>
  )
}

export function EmailPreviewCard({ email }: { email: NonNullable<WorkspaceMessage["email"]> }) {
  return (
    <div className={styles.panelCard}>
      {email.to && (
        <div className={styles.emailRow}>
          <span className={styles.emailRowLabel}>To</span>
          <span>{email.to}</span>
        </div>
      )}
      <p className={styles.emailSubject}>{email.subject}</p>
      <div className={styles.divider} />
      <p className={styles.emailBody}>{email.body}</p>
    </div>
  )
}

export function BackTestCard({ backTest }: { backTest: NonNullable<WorkspaceMessage["backTest"]> }) {
  return (
    <div className={styles.panelCard}>
      <p className={styles.cardCaption}>
        Back-test on sample data — illustrative only, nothing has actually run.
      </p>
      {backTest.items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={styles.resultRow}>
          {item.matched ? (
            <CheckCircle2 size={16} aria-hidden="true" className={styles.resultIcon} />
          ) : (
            <MinusCircle size={16} aria-hidden="true" className={styles.resultIconQuiet} />
          )}
          <div>
            <div className={styles.resultLabel}>{item.label}</div>
            <div className={styles.resultDetail}>{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const THINKING_WORDS = [
  "Thinking",
  "Percolating",
  "Noodling",
  "Pondering",
  "Configuring",
  "Considering",
  "Assembling",
  "Drafting",
  "Untangling",
  "Deliberating",
  "Sketching",
  "Formulating",
  "Marshalling",
  "Reticulating",
  "Cogitating",
]

export function ThinkingIndicator({ label }: { label: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((prev) => (prev + 1) % THINKING_WORDS.length), 1600)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={styles.message}>
      <span className={[styles.avatar, styles.avatarAgent].join(" ")} aria-hidden="true">
        <Sparkles size={14} />
      </span>
      <div className={styles.messageBody}>
        <div className={styles.thinking} aria-live="polite">
          <span>
            {label} · {THINKING_WORDS[index]}…
          </span>
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
        </div>
      </div>
    </div>
  )
}

export function BuilderReadyCue() {
  return (
    <p className={styles.readyCue}>
      Your configuration is ready in the Builder
      <ChevronRight size={14} aria-hidden="true" className={styles.cueChevron} />
    </p>
  )
}

export function MessageRow({
  message,
  interactiveQuestion,
  canApplyEmail,
  onAnswer,
  onDismissQuestion,
  onApplyEmail,
  onDiscardEmail,
}: {
  message: WorkspaceMessage
  interactiveQuestion: boolean
  canApplyEmail: boolean
  onAnswer: (answer: string) => void
  onDismissQuestion: () => void
  onApplyEmail: () => void
  onDiscardEmail: () => void
}) {
  const isAgent = message.role === "assistant"

  return (
    <>
      <div className={styles.message}>
        <span
          className={[styles.avatar, isAgent ? styles.avatarAgent : styles.avatarUser].join(" ")}
          aria-hidden="true"
        >
          {isAgent ? <Sparkles size={14} /> : <User size={14} />}
        </span>
        <div className={styles.messageBody}>
          <span className={styles.messageLabel}>{isAgent ? "Agent" : "You"}</span>
          {message.content &&
            (isAgent ? <RichText text={message.content} /> : <p className={styles.userText}>{message.content}</p>)}

          {message.question && (
            <QuestionCard
              question={message.question}
              interactive={interactiveQuestion}
              onAnswer={onAnswer}
              onDismiss={onDismissQuestion}
            />
          )}

          {message.email && (
            <>
              <EmailPreviewCard email={message.email} />
              {canApplyEmail && (
                <div className={styles.inlineActions}>
                  <Button variant="violet" onClick={onApplyEmail}>
                    Apply to Proposed config
                  </Button>
                  <Button variant="ghost" onClick={onDiscardEmail}>
                    Discard
                  </Button>
                </div>
              )}
              {message.email.applied && <Badge tone="violet">Applied to the configuration</Badge>}
              {message.email.discarded && <Badge>Discarded</Badge>}
            </>
          )}

          {message.backTest && <BackTestCard backTest={message.backTest} />}
        </div>
      </div>
      {message.configReady && <BuilderReadyCue />}
    </>
  )
}
