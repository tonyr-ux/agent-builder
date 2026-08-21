"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronRight, Download, RefreshCw } from "lucide-react"
import styles from "./automation.module.css"
import { Badge, Button } from "./ui"

type LogEvent = {
  id: string
  session_id: string
  turn_index: number
  action: string
  model: string | null
  agent_name: string | null
  user_message: string
  request_json: unknown
  current_config: unknown
  raw_response: string | null
  parsed_json: unknown
  error: string | null
  duration_ms: number | null
  user_agent: string | null
  created_at: string
}

type LogPayload = { exportedAt: string; count: number; limit: number; events: LogEvent[] }

function Entry({ event }: { event: LogEvent }) {
  const [open, setOpen] = useState(false)
  const when = new Date(event.created_at).toLocaleString("en-GB")

  return (
    <div className={styles.logEntry}>
      <button type="button" className={styles.logEntryHead} onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={[styles.disclosureChevron, open ? styles.disclosureChevronOpen : ""].filter(Boolean).join(" ")}
        />
        <span className={styles.logEntryTitle}>{event.user_message}</span>
        <span className={styles.logEntryMeta}>
          {event.action} · turn {event.turn_index} · {when}
          {event.duration_ms !== null ? ` · ${(event.duration_ms / 1000).toFixed(1)}s` : ""}
        </span>
        {event.error ? <Badge>Error</Badge> : null}
      </button>
      {open && (
        <div className={styles.logEntryBody}>
          <div className={styles.logMetaRow}>
            session {event.session_id}
            {event.model ? ` · ${event.model}` : ""}
            {event.agent_name ? ` · editing "${event.agent_name}"` : ""}
          </div>
          <div className={styles.logSectionLabel}>Model response (raw, before parsing)</div>
          <pre className={styles.logPre}>{event.raw_response ?? event.error ?? "—"}</pre>
          <div className={styles.logSectionLabel}>Parsed by the UI</div>
          <pre className={styles.logPre}>{JSON.stringify(event.parsed_json, null, 2)}</pre>
          <div className={styles.logSectionLabel}>Request sent to the model</div>
          <pre className={styles.logPre}>{JSON.stringify(event.request_json, null, 2)}</pre>
          {event.current_config ? (
            <>
              <div className={styles.logSectionLabel}>Configuration being edited</div>
              <pre className={styles.logPre}>{JSON.stringify(event.current_config, null, 2)}</pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function SessionLogView() {
  const [payload, setPayload] = useState<LogPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/agent-builder/log?limit=500", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`)
      setPayload(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load the log")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const download = () => {
    if (!payload) return
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `config-agent-sessions-${payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const sessions = new Set((payload?.events ?? []).map((event) => event.session_id)).size

  return (
    <div className={[styles.tokens, styles.logPage].join(" ")}>
      <div className={styles.logInner}>
        <div className={styles.logHeader}>
          <div>
            <h1 className={styles.createdTitle}>Session log</h1>
            <p className={styles.createdSubtitle}>
              {loading
                ? "Loading…"
                : error
                  ? "Couldn't load the log."
                  : `${payload?.count ?? 0} turns across ${sessions} ${sessions === 1 ? "session" : "sessions"}, newest first.`}
            </p>
          </div>
          <div className={styles.logActions}>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </Button>
            <Button variant="violet" onClick={download} disabled={!payload?.count}>
              <Download size={14} aria-hidden="true" />
              Download JSON
            </Button>
          </div>
        </div>

        {error && <p className={styles.logError}>{error}</p>}

        {!loading && !error && payload?.count === 0 && (
          <p className={styles.emptyNote}>
            Nothing recorded yet. Each turn in the Agents workspace adds an entry here.
          </p>
        )}

        <div className={styles.logList}>
          {(payload?.events ?? []).map((event) => (
            <Entry key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  )
}
