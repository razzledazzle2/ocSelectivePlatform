import type { ReactNode } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * Minimal, dependency-free renderer for question/stimulus text. Supports:
 * - paragraphs (blank-line separated) with single-newline line breaks
 * - GitHub-style pipe tables (`| a | b |`)
 * - **bold** and *italic* inline formatting
 * Everything is rendered as React nodes (never raw HTML strings), so any other
 * markup in the text stays literal. Server-component friendly.
 */

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

/** Renders **bold** / *italic* spans in a single line of text as React nodes. */
export function renderInlineMarkdown(text: string): ReactNode {
  const parts = text.split(INLINE_PATTERN)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return part
  })
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
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1)
  }
  if (trimmed.endsWith('|')) {
    trimmed = trimmed.slice(0, -1)
  }
  return trimmed.split('|').map((cell) => cell.trim())
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines.map(splitTableRow)
  const hasHeader = rows.length > 1 && isSeparatorRow(rows[1])
  const headerCells = hasHeader ? rows[0] : null
  const bodyRows = hasHeader ? rows.slice(2) : rows

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        {headerCells ? (
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {headerCells.map((cell, index) => (
                <TableHead key={index} className="whitespace-normal px-3">
                  {renderInlineMarkdown(cell)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        ) : null}
        <TableBody>
          {bodyRows.map((cells, rowIndex) => (
            <TableRow key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="whitespace-normal px-3 py-2 align-top">
                  {renderInlineMarkdown(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Paragraph({ lines }: { lines: string[] }) {
  return (
    <p className="whitespace-normal">
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {renderInlineMarkdown(line)}
        </span>
      ))}
    </p>
  )
}

interface QuestionMarkdownProps {
  text: string | null | undefined
  className?: string
}

export function QuestionMarkdown({ text, className }: QuestionMarkdownProps) {
  if (!text || !text.trim()) {
    return null
  }

  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const rendered: ReactNode[] = []
  let key = 0

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0)
    if (!lines.length) {
      continue
    }

    // Split the block into runs of table lines vs plain text lines so a table
    // directly under a sentence (no blank line) still renders as a table.
    let buffer: string[] = []
    let bufferIsTable = isTableLine(lines[0])

    const flush = () => {
      if (!buffer.length) return
      rendered.push(
        bufferIsTable ? (
          <MarkdownTable key={key} lines={buffer} />
        ) : (
          <Paragraph key={key} lines={buffer} />
        )
      )
      key += 1
      buffer = []
    }

    for (const line of lines) {
      const lineIsTable = isTableLine(line)
      if (lineIsTable !== bufferIsTable) {
        flush()
        bufferIsTable = lineIsTable
      }
      buffer.push(line)
    }
    flush()
  }

  if (!rendered.length) {
    return null
  }

  return <div className={cn('space-y-3', className)}>{rendered}</div>
}
