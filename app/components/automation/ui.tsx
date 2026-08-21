"use client"

import type { ReactNode } from "react"
import { useId, useState } from "react"
import { ChevronRight } from "lucide-react"
import styles from "./automation.module.css"

type ButtonVariant = "ghost" | "outline" | "violet" | "gradient"

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  ghost: styles.buttonGhost,
  outline: styles.buttonOutline,
  violet: styles.buttonViolet,
  gradient: styles.buttonGradient,
}

export function Button({
  variant = "ghost",
  full = false,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant
  full?: boolean
  className?: string
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[styles.button, VARIANT_CLASS[variant], full ? styles.buttonFull : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "live" | "violet"
  icon?: ReactNode
  children: ReactNode
}) {
  const toneClass = tone === "live" ? styles.badgeLive : tone === "violet" ? styles.badgeViolet : ""
  return (
    <span className={[styles.badge, toneClass].filter(Boolean).join(" ")}>
      {icon}
      {children}
    </span>
  )
}

/** Status is always paired with its label, never colour alone. */
export function StatusBadge({ status }: { status: "live" | "off" | "draft" | "building" | "updating" }) {
  if (status === "live") return <Badge tone="live">Live</Badge>
  if (status === "off") return <Badge>Off</Badge>
  if (status === "building") return <Badge tone="violet">Building…</Badge>
  if (status === "updating") return <Badge tone="violet">Updating…</Badge>
  return <Badge>Draft</Badge>
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[styles.switch, checked ? styles.switchOn : ""].filter(Boolean).join(" ")}
    >
      <span className={styles.switchKnob} />
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[styles.segment, active ? styles.segmentActive : ""].filter(Boolean).join(" ")}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.disclosureButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={[styles.disclosureChevron, open ? styles.disclosureChevronOpen : ""].filter(Boolean).join(" ")}
        />
        {summary}
      </button>
      {open && (
        <div id={panelId} className={styles.disclosurePanel}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className={styles.bullets}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={styles.bullet}>
          <span className={styles.bulletDot} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Checklist({ steps }: { steps: string[] }) {
  return (
    <ol className={styles.checklist}>
      {steps.map((step, index) => (
        <li key={`${step}-${index}`} className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  )
}

export function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      {label && <div className={styles.sectionLabel}>{label}</div>}
      {children}
    </div>
  )
}
