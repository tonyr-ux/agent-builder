/**
 * Turns a Configuration Agent reply into the pieces the workspace renders.
 *
 * The agent replies in prose (see app/api/agent-builder/chat/systemPrompt.ts):
 * clarifying questions carry 2-5 pickable options, back-tests are one line per
 * sample item, and email previews quote a subject and body. Structured parsing
 * of back-tests and previews is gated on the action that started the turn, so an
 * ordinary reply is never mistaken for one; anything unparsed falls back to
 * plain text.
 */

export type ParsedQuestion = {
  prompt: string
  options: string[]
}

export type ParsedEmail = {
  to?: string
  subject: string
  body: string
}

export type ParsedBackTest = {
  intro?: string
  items: { label: string; detail: string }[]
}

/** Bullet or numbered list markers: "- x", "* x", "• x", "1. x", "2) x" */
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/

function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1").trim()
}

function listItems(lines: string[]): string[] {
  const items: string[] = []
  for (const line of lines) {
    const match = line.match(LIST_MARKER)
    if (!match) break
    items.push(stripInlineMarkdown(match[1]))
  }
  return items
}

/**
 * A clarifying question: a line ending in "?" followed by 2-5 list options.
 * Returns the question plus the reply with that block removed, so the card
 * doesn't repeat what the prose already says.
 */
export function extractQuestion(response: string): { question: ParsedQuestion; rest: string } | null {
  const lines = response.split("\n")

  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = stripInlineMarkdown(lines[i])
    if (!candidate.endsWith("?")) continue

    // Options follow the question, ignoring blank lines between
    let cursor = i + 1
    while (cursor < lines.length && !lines[cursor].trim()) cursor++
    const options = listItems(lines.slice(cursor))
    if (options.length < 2 || options.length > 5) continue

    const consumedTo = cursor + options.length
    const rest = [...lines.slice(0, i), ...lines.slice(consumedTo)].join("\n").replace(/\n{3,}/g, "\n\n").trim()
    return { question: { prompt: candidate, options }, rest }
  }

  return null
}

/** An email preview: a Subject line plus the body beneath it. */
export function extractEmail(response: string): ParsedEmail | null {
  const lines = response.split("\n")
  const subjectIndex = lines.findIndex((line) => /^\s*(?:\*\*)?subject\s*(?:\*\*)?:/i.test(line))
  if (subjectIndex === -1) return null

  const subject = stripInlineMarkdown(lines[subjectIndex].replace(/^\s*(?:\*\*)?subject\s*(?:\*\*)?:/i, ""))
  if (!subject) return null

  const toLine = lines.find((line) => /^\s*(?:\*\*)?to\s*(?:\*\*)?:/i.test(line))
  const to = toLine ? stripInlineMarkdown(toLine.replace(/^\s*(?:\*\*)?to\s*(?:\*\*)?:/i, "")) : undefined

  const body = lines
    .slice(subjectIndex + 1)
    .join("\n")
    .replace(/^\s*(?:\*\*)?body\s*(?:\*\*)?:\s*/i, "")
    .replace(/^[\s\n]*[-–—]{3,}[\s\n]*/, "")
    .trim()

  if (!body) return null
  return { to, subject, body }
}

/**
 * Back-test results: one line per sample item, "<label> — <what happened>".
 * Accepts an em/en dash, arrow, or a colon as the separator.
 */
const BACKTEST_SPLIT = /\s(?:—|–|→|->)\s|:\s(?=\S)/

export function extractBackTest(response: string): ParsedBackTest | null {
  const lines = response.split("\n")
  const items: { label: string; detail: string }[] = []
  const introLines: string[] = []

  for (const line of lines) {
    const marker = line.match(LIST_MARKER)
    const candidate = stripInlineMarkdown(marker ? marker[1] : line)
    if (!candidate) continue

    const parts = candidate.split(BACKTEST_SPLIT)
    if (marker && parts.length >= 2) {
      const [label, ...detail] = parts
      items.push({ label: label.trim(), detail: detail.join(" — ").trim() })
    } else if (items.length === 0) {
      introLines.push(candidate)
    }
  }

  if (items.length < 2) return null
  return { intro: introLines.join(" ") || undefined, items }
}

/** Very light markdown: paragraphs, bullet lists and bold. */
export type RichBlock =
  | { kind: "paragraph"; spans: { text: string; bold: boolean }[] }
  | { kind: "list"; items: { text: string; bold: boolean }[][] }

function spans(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    )
}

export function toRichBlocks(text: string): RichBlock[] {
  const blocks: RichBlock[] = []
  let paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ kind: "paragraph", spans: spans(paragraph.join(" ")) })
    paragraph = []
  }
  const flushList = () => {
    if (!list.length) return
    blocks.push({ kind: "list", items: list.map(spans) })
    list = []
  }

  for (const line of text.split("\n")) {
    const marker = line.match(LIST_MARKER)
    if (marker) {
      flushParagraph()
      list.push(marker[1])
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()
  return blocks
}
