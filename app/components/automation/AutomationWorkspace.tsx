"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles } from "lucide-react"
import styles from "./automation.module.css"
import { ChatPane } from "./ChatPane"
import { PrototypeBanner } from "./PrototypeBanner"
import { ConfigCard } from "./ConfigCard"
import { extractBackTest, extractEmail, extractQuestion } from "./parseReply"
import { recordTurn } from "./sessionLog"
import {
  findAgent,
  saveAgent,
  type PendingAction,
  type SavedAgent,
  type WorkspaceMessage,
} from "./workspaceTypes"
import { extractConfigBlock, serialiseConfig, stripConfigBlock, type XelixConfig } from "../agentbuilder/xelixConfig"

const PREVIEW_PROMPT = "Show me a preview of this email, filled in with sample data."
const BACKTEST_PROMPT = "Run a back-test on recent invoices and show me what this would have done."

let messageCounter = 0
function nextId(prefix: string): string {
  messageCounter += 1
  return `${prefix}-${Date.now()}-${messageCounter}`
}

function Aurora() {
  return (
    <div className={styles.aurora} aria-hidden="true">
      <div className={[styles.bloom, styles.bloomPurple].join(" ")} />
      <div className={[styles.bloom, styles.bloomPink].join(" ")} />
      <div className={[styles.bloom, styles.bloomBlue].join(" ")} />
    </div>
  )
}

export function AutomationWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentParam = searchParams.get("agent")

  const [messages, setMessages] = useState<WorkspaceMessage[]>([])
  const [draftConfig, setDraftConfig] = useState<XelixConfig | null>(null)
  const [agent, setAgent] = useState<SavedAgent | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Bumped when the operator jumps to the Builder from the chat cue */
  const [highlightNonce, setHighlightNonce] = useState(0)
  const builderBodyRef = useRef<HTMLDivElement>(null)

  // The transcript as sent to the API — kept in a ref so a send can read the
  // latest history without waiting for a re-render
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([])
  const turnCountRef = useRef(0)

  const config = agent?.config ?? draftConfig

  // Deep link: ?agent=<id> opens that saved agent with its transcript
  useEffect(() => {
    if (!agentParam) return
    const found = findAgent(agentParam)
    if (!found) return
    setAgent(found)
    setDraftConfig(null)
    setMessages(found.messages)
    historyRef.current = found.messages.map((message) => ({ role: message.role, content: message.content }))
  }, [agentParam])

  const appendMessage = useCallback((message: WorkspaceMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const runTurn = useCallback(
    async (userText: string, action: PendingAction) => {
      setError(null)
      const userMessage: WorkspaceMessage = { id: nextId("user"), role: "user", content: userText }
      appendMessage(userMessage)
      historyRef.current = [...historyRef.current, { role: "user", content: userText }]
      setPending(action)

      const startedAt = Date.now()
      turnCountRef.current += 1
      const turnIndex = turnCountRef.current
      const request = { messages: historyRef.current, currentPrompt: agent ? serialiseConfig(agent.config) : undefined }

      try {
        const response = await fetch("/api/agent-builder/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyRef.current,
            currentPrompt: agent ? serialiseConfig(agent.config) : undefined,
            agentName: agent?.name,
          }),
        })

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null)
          throw new Error(detail?.error || `The Configuration Agent is unavailable (${response.status}).`)
        }

        // Stream the SSE body to completion, then parse the whole reply
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let full = ""
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const payload = line.slice(6)
            if (payload === "[DONE]") continue
            try {
              const parsed = JSON.parse(payload)
              full += parsed.choices?.[0]?.delta?.content ?? ""
            } catch {
              // Ignore partial frames
            }
          }
        }

        historyRef.current = [...historyRef.current, { role: "assistant", content: full }]

        // Configuration block first — it decides what the Builder shows
        const block = extractConfigBlock(full)
        const prose = block ? stripConfigBlock(full, block.blockText) : full
        const reply: WorkspaceMessage = { id: nextId("agent"), role: "assistant", content: prose }

        if (block) {
          if (agent) {
            setAgent((prev) => (prev ? { ...prev, config: block.config } : prev))
          } else {
            setDraftConfig(block.config)
          }
          reply.configReady = true
        }

        // Structured blocks are only looked for when the operator asked for them
        if (action.kind === "backtest") {
          const backTest = extractBackTest(prose)
          if (backTest) {
            reply.backTest = backTest
            reply.content = backTest.intro ?? ""
          }
        } else if (action.kind === "preview") {
          const email = extractEmail(prose)
          if (email) {
            reply.email = email
            // Keep only the lead-in above the quoted email
            const lines = prose.split("\n")
            const headerLine = lines.findIndex((line) => /^\s*(?:\*\*)?(?:to|subject)\s*(?:\*\*)?:/i.test(line))
            reply.content = (headerLine > 0 ? lines.slice(0, headerLine) : []).join("\n").trim()
          }
        } else {
          const question = extractQuestion(prose)
          if (question) {
            reply.question = question.question
            reply.content = question.rest
          }
        }

        recordTurn({
          turnIndex,
          action: action.kind,
          agentName: agent?.name,
          userMessage: userText,
          request,
          currentConfig: agent?.config,
          rawResponse: full,
          parsed: {
            prose: reply.content,
            config: block?.config,
            question: reply.question,
            email: reply.email,
            backTest: reply.backTest,
          },
          durationMs: Date.now() - startedAt,
        })

        appendMessage(reply)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Something went wrong."
        setError(message)
        recordTurn({
          turnIndex,
          action: action.kind,
          agentName: agent?.name,
          userMessage: userText,
          request,
          currentConfig: agent?.config,
          error: message,
          durationMs: Date.now() - startedAt,
        })
        appendMessage({
          id: nextId("agent"),
          role: "assistant",
          content: `I couldn't reach the Configuration Agent just now. ${message}`,
        })
      } finally {
        setPending(null)
      }
    },
    [agent, appendMessage],
  )

  const handleSend = useCallback(
    (text: string) => {
      void runTurn(text, { label: "Building agent", kind: "build" })
    },
    [runTurn],
  )

  const handleAnswer = useCallback(
    (messageId: string, answer: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.question
            ? { ...message, question: { ...message.question, answered: true } }
            : message,
        ),
      )
      void runTurn(answer, { label: "Building agent", kind: "build" })
    },
    [runTurn],
  )

  const handleDismissQuestion = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId && message.question
          ? { ...message, question: { ...message.question, dismissed: true } }
          : message,
      ),
    )
  }, [])

  const handleApplyEmail = useCallback(
    (messageId: string) => {
      const target = messages.find((message) => message.id === messageId)
      if (!target?.email) return
      const { subject, body } = target.email

      setDraftConfig((current) => (current ? { ...current, responseSubject: subject, responseBody: body } : current))
      setAgent((current) =>
        current
          ? { ...current, config: { ...current.config, responseSubject: subject, responseBody: body } }
          : current,
      )
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.email
            ? { ...message, email: { ...message.email, applied: true } }
            : message,
        ),
      )
    },
    [messages],
  )

  const handleDiscardEmail = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId && message.email
          ? { ...message, email: { ...message.email, discarded: true } }
          : message,
      ),
    )
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setDraftConfig(null)
    setAgent(null)
    setPending(null)
    setError(null)
    historyRef.current = []
    if (agentParam) router.replace("/settings/automation")
  }, [agentParam, router])

  const handleAccept = useCallback(() => {
    if (!draftConfig) return
    const firstUserMessage = messages.find((message) => message.role === "user")
    const saved: SavedAgent = {
      id: nextId("agent-record"),
      name: draftConfig.summary?.trim() || "Untitled agent",
      config: draftConfig,
      createdAt: new Date().toISOString(),
      live: true,
      firstPrompt: firstUserMessage?.content ?? "",
      messages,
      appliedCount: 0,
    }
    saveAgent(saved)
    setAgent(saved)
    setDraftConfig(null)
  }, [draftConfig, messages])

  const handleToggleLive = useCallback((next: boolean) => {
    setAgent((prev) => {
      if (!prev) return prev
      const updated = { ...prev, live: next }
      saveAgent(updated)
      return updated
    })
  }, [])

  const handleModeChange = useCallback((mode: NonNullable<XelixConfig["mode"]>) => {
    setDraftConfig((prev) => (prev ? { ...prev, mode } : prev))
    setAgent((prev) => {
      if (!prev) return prev
      const updated = { ...prev, config: { ...prev.config, mode } }
      saveAgent(updated)
      return updated
    })
  }, [])

  // Keep the saved record's transcript in step with the conversation
  useEffect(() => {
    if (!agent || agent.messages === messages) return
    const updated = { ...agent, messages }
    saveAgent(updated)
    setAgent(updated)
  }, [agent, messages])

  const questionMessages = messages.filter((message) => message.question)
  const latestQuestionId = questionMessages.length ? questionMessages[questionMessages.length - 1].id : null
  const emailMessages = messages.filter((message) => message.email)
  const latestEmailId = emailMessages.length ? emailMessages[emailMessages.length - 1].id : null

  const highlightConfig = useCallback(() => {
    setHighlightNonce((prev) => prev + 1)
    builderBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  return (
    <div className={[styles.tokens, styles.workspace].join(" ")}>
      <Aurora />
      <div className={styles.shell}>
        <PrototypeBanner />
        <div className={styles.content}>
        <ChatPane
          messages={messages}
          agent={agent}
          draftConfig={draftConfig}
          pending={pending}
          latestQuestionId={latestQuestionId}
          latestEmailId={latestEmailId}
          onSend={handleSend}
          onAnswer={handleAnswer}
          onDismissQuestion={handleDismissQuestion}
          onApplyEmail={handleApplyEmail}
          onDiscardEmail={handleDiscardEmail}
          onNewAgent={reset}
          onStartOver={reset}
          onHighlightConfig={highlightConfig}
        />

        <aside className={styles.builder} aria-label="Builder">
          <div className={styles.builderHeader}>
            <span className={styles.builderMark} aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className={styles.builderTitle}>Builder</h2>
              <div className={styles.builderSubtitle}>The plan takes shape as you chat</div>
            </div>
          </div>
          <div className={styles.builderBody} ref={builderBodyRef}>
            <ConfigCard
              highlightNonce={highlightNonce}
              config={config}
              generating={!!pending && pending.kind === "build"}
              saved={!!agent}
              live={agent?.live ?? false}
              editable={!pending}
              backTestDisabled={!!pending}
              onModeChange={handleModeChange}
              onToggleLive={handleToggleLive}
              onAccept={handleAccept}
              onRunBackTest={() => void runTurn(BACKTEST_PROMPT, { label: "Running back-test", kind: "backtest" })}
              onPreviewEmail={() => void runTurn(PREVIEW_PROMPT, { label: "Loading preview", kind: "preview" })}
            />
            {error && (
              <p className={styles.emptyNote} role="status" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}
          </div>
        </aside>
        </div>
      </div>
    </div>
  )
}

/**
 * Entry point for the route. useSearchParams needs a Suspense boundary, and
 * AppLayout clones its child with extra props, so it gets a plain wrapper.
 */
export function AutomationWorkspacePanel() {
  return (
    <Suspense fallback={null}>
      <AutomationWorkspace />
    </Suspense>
  )
}
