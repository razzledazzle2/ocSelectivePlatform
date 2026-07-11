/**
 * Pure, dependency-free Markdown → AST parser for question/stimulus content.
 *
 * It supports the assessment-authoring subset only, and NEVER emits raw HTML —
 * the React renderer (`src/components/questions/question-markdown.tsx`) turns
 * this AST into React nodes, so any unsupported markup stays literal text and
 * cannot inject markup. Math is captured as opaque TeX strings here and handed
 * to KaTeX at render time (see `render-math.ts`).
 *
 * Supported:
 * - paragraphs (blank-line separated) with single-newline line breaks
 * - headings `#`..`######`
 * - unordered lists (`- `, `* `) and ordered lists (`1. `)
 * - blockquotes (`> `)
 * - GitHub-style pipe tables (`| a | b |`)
 * - inline `**bold**` / `*italic*`
 * - inline maths `\( … \)` and `$ … $`
 * - display maths `\[ … \]` and `$$ … $$`
 *
 * This module is client-safe (no React, no server imports) and unit-tested.
 */

export type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'math'; tex: string }

export type MarkdownBlock =
  | { kind: 'paragraph'; lines: InlineSegment[][] }
  | { kind: 'heading'; level: number; content: InlineSegment[] }
  | { kind: 'list'; ordered: boolean; items: InlineSegment[][] }
  | { kind: 'blockquote'; lines: InlineSegment[][] }
  | { kind: 'table'; header: InlineSegment[][] | null; rows: InlineSegment[][][] }
  | { kind: 'mathBlock'; tex: string }

/** Emphasis is matched greedily but does not nest (matches the legacy renderer). */
const EMPHASIS_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

/**
 * True when a `$…$` candidate looks like maths rather than currency/prose.
 * Requires a TeX-ish character so "$5 and $10" is left as literal text.
 */
function looksLikeMath(inner: string): boolean {
  return /[\\^_{}=+\-<>/]|[a-zA-Z]\s*[0-9]|[0-9]\s*[a-zA-Z]/.test(inner)
}

/**
 * Split a single line of text into inline segments, extracting maths spans
 * first (so `*`/`_` inside TeX is never treated as emphasis) and then bold /
 * italic runs from the remaining plain text.
 */
export function tokenizeInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let index = 0

  const pushText = (value: string) => {
    if (!value) return
    for (const part of value.split(EMPHASIS_PATTERN)) {
      if (!part) continue
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        segments.push({ kind: 'bold', value: part.slice(2, -2) })
      } else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        segments.push({ kind: 'italic', value: part.slice(1, -1) })
      } else {
        segments.push({ kind: 'text', value: part })
      }
    }
  }

  let plain = ''
  while (index < text.length) {
    // Inline maths: \( … \)
    if (text.startsWith('\\(', index)) {
      const close = text.indexOf('\\)', index + 2)
      if (close !== -1) {
        pushText(plain)
        plain = ''
        segments.push({ kind: 'math', tex: text.slice(index + 2, close).trim() })
        index = close + 2
        continue
      }
    }
    // Inline maths: $ … $ (guarded against currency)
    if (text[index] === '$' && text[index + 1] !== '$') {
      const close = text.indexOf('$', index + 1)
      if (close !== -1) {
        const inner = text.slice(index + 1, close)
        if (inner.trim() && !/^\s|\s$/.test(inner) && looksLikeMath(inner)) {
          pushText(plain)
          plain = ''
          segments.push({ kind: 'math', tex: inner.trim() })
          index = close + 1
          continue
        }
      }
    }
    plain += text[index]
    index += 1
  }
  pushText(plain)

  return segments
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.length > 1
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()))
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((cell) => cell.trim())
}

type LineKind = 'heading' | 'table' | 'ulist' | 'olist' | 'quote' | 'text'

function classifyLine(line: string): LineKind {
  const trimmed = line.trim()
  if (/^#{1,6}\s+/.test(trimmed)) return 'heading'
  if (isTableLine(trimmed)) return 'table'
  if (/^[-*]\s+/.test(trimmed)) return 'ulist'
  if (/^\d+[.)]\s+/.test(trimmed)) return 'olist'
  if (/^>\s?/.test(trimmed)) return 'quote'
  return 'text'
}

/** Build the blocks for a run of same-kind lines that isn't display maths. */
function blocksFromRun(kind: LineKind, lines: string[], out: MarkdownBlock[]): void {
  switch (kind) {
    case 'heading':
      for (const line of lines) {
        const match = line.trim().match(/^(#{1,6})\s+(.*)$/)
        if (match) {
          out.push({ kind: 'heading', level: match[1].length, content: tokenizeInline(match[2].trim()) })
        }
      }
      break
    case 'table': {
      const rows = lines.map(splitTableRow)
      const hasHeader = rows.length > 1 && isSeparatorRow(rows[1])
      const header = hasHeader ? rows[0].map(tokenizeInline) : null
      const bodyRows = (hasHeader ? rows.slice(2) : rows).map((cells) => cells.map(tokenizeInline))
      out.push({ kind: 'table', header, rows: bodyRows })
      break
    }
    case 'ulist':
      out.push({
        kind: 'list',
        ordered: false,
        items: lines.map((line) => tokenizeInline(line.trim().replace(/^[-*]\s+/, ''))),
      })
      break
    case 'olist':
      out.push({
        kind: 'list',
        ordered: true,
        items: lines.map((line) => tokenizeInline(line.trim().replace(/^\d+[.)]\s+/, ''))),
      })
      break
    case 'quote':
      out.push({
        kind: 'blockquote',
        lines: lines.map((line) => tokenizeInline(line.trim().replace(/^>\s?/, ''))),
      })
      break
    default:
      out.push({ kind: 'paragraph', lines: lines.map(tokenizeInline) })
  }
}

/** Parse a text region (already free of display maths) into blocks. */
function parseTextRegion(region: string, out: MarkdownBlock[]): void {
  for (const rawBlock of region.split(/\n{2,}/)) {
    const lines = rawBlock.split('\n').filter((line) => line.trim().length > 0)
    if (!lines.length) continue

    let runKind = classifyLine(lines[0])
    let buffer: string[] = []
    const flush = () => {
      if (buffer.length) blocksFromRun(runKind, buffer, out)
      buffer = []
    }
    for (const line of lines) {
      const kind = classifyLine(line)
      // Headings are always standalone; other kinds group into runs.
      if (kind !== runKind || kind === 'heading') {
        flush()
        runKind = kind
      }
      buffer.push(line)
    }
    flush()
  }
}

const DISPLAY_MATH_PATTERN = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g

/** Parse full Markdown text into a block AST. */
export function parseMarkdown(text: string): MarkdownBlock[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const blocks: MarkdownBlock[] = []

  let lastIndex = 0
  for (const match of normalized.matchAll(DISPLAY_MATH_PATTERN)) {
    const start = match.index ?? 0
    if (start > lastIndex) parseTextRegion(normalized.slice(lastIndex, start), blocks)
    const tex = (match[1] ?? match[2] ?? '').trim()
    if (tex) blocks.push({ kind: 'mathBlock', tex })
    lastIndex = start + match[0].length
  }
  if (lastIndex < normalized.length) parseTextRegion(normalized.slice(lastIndex), blocks)

  return blocks
}
