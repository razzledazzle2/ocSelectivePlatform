import type { ReactNode } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  parseMarkdown,
  tokenizeInline,
  type InlineSegment,
  type MarkdownBlock,
} from '@/lib/content/markdown-ast'
import { renderMathToHtml } from '@/lib/content/render-math'
import { cn } from '@/lib/utils'

/**
 * Shared, dependency-light renderer for question / stimulus / option / solution
 * content. Parsing lives in `@/lib/content/markdown-ast` (pure, unit-tested);
 * this component only maps the AST to React nodes. Text is NEVER injected as raw
 * HTML — the sole `dangerouslySetInnerHTML` is KaTeX output rendered in safe
 * (`trust: false`) mode, so imported content cannot inject scripts or styling.
 *
 * Supports paragraphs, headings, ordered/unordered lists, blockquotes, GitHub
 * pipe tables, `**bold**`/`*italic*`, inline maths `\( … \)` / `$ … $` and
 * display maths `\[ … \]` / `$$ … $$`.
 */

function InlineMath({ tex }: { tex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderMathToHtml(tex, false) }} />
}

function DisplayMath({ tex }: { tex: string }) {
  return (
    <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: renderMathToHtml(tex, true) }} />
  )
}

function renderSegments(segments: InlineSegment[], keyPrefix: string): ReactNode[] {
  return segments.map((segment, index) => {
    const key = `${keyPrefix}-${index}`
    switch (segment.kind) {
      case 'bold':
        return <strong key={key}>{segment.value}</strong>
      case 'italic':
        return <em key={key}>{segment.value}</em>
      case 'math':
        return <InlineMath key={key} tex={segment.tex} />
      default:
        return <span key={key}>{segment.value}</span>
    }
  })
}

/**
 * Inline-only renderer (bold / italic / inline maths) for contexts that must
 * stay inside a single flow element — e.g. answer options nested in a `<button>`.
 */
export function renderInlineMarkdown(text: string): ReactNode {
  return renderSegments(tokenizeInline(text), 'inline')
}

function BlockView({ block, blockKey }: { block: MarkdownBlock; blockKey: string }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (`h${Math.min(block.level + 2, 6)}` as unknown) as keyof React.JSX.IntrinsicElements
      return (
        <Tag className="font-heading text-base font-semibold text-foreground">
          {renderSegments(block.content, blockKey)}
        </Tag>
      )
    }
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag className={cn('space-y-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, index) => (
            <li key={`${blockKey}-${index}`}>{renderSegments(item, `${blockKey}-${index}`)}</li>
          ))}
        </ListTag>
      )
    }
    case 'blockquote':
      return (
        <blockquote className="border-l-2 border-border pl-4 text-foreground/80">
          {block.lines.map((line, index) => (
            <span key={`${blockKey}-${index}`} className="block">
              {renderSegments(line, `${blockKey}-${index}`)}
            </span>
          ))}
        </blockquote>
      )
    case 'table':
      return (
        <div className="overflow-x-auto">
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              {block.header ? (
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {block.header.map((cell, index) => (
                      <TableHead key={index} scope="col" className="whitespace-normal px-3">
                        {renderSegments(cell, `${blockKey}-h-${index}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              ) : null}
              <TableBody>
                {block.rows.map((cells, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {cells.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className="whitespace-normal px-3 py-2 align-top"
                      >
                        {renderSegments(cell, `${blockKey}-${rowIndex}-${cellIndex}`)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )
    case 'mathBlock':
      return <DisplayMath tex={block.tex} />
    default:
      return (
        <p className="whitespace-normal">
          {block.lines.map((line, index) => (
            <span key={`${blockKey}-${index}`}>
              {index > 0 ? <br /> : null}
              {renderSegments(line, `${blockKey}-${index}`)}
            </span>
          ))}
        </p>
      )
  }
}

interface QuestionMarkdownProps {
  text: string | null | undefined
  className?: string
}

export function QuestionMarkdown({ text, className }: QuestionMarkdownProps) {
  if (!text || !text.trim()) {
    return null
  }

  const blocks = parseMarkdown(text)
  if (!blocks.length) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} blockKey={`b${index}`} />
      ))}
    </div>
  )
}
