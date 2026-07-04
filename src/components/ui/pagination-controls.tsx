'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ADMIN_QUESTION_PAGE_SIZES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PaginationControlsProps {
  page: number
  pageCount: number
  totalCount: number
  pageSize: number
  /** Singular noun for the range summary, e.g. "question". */
  itemLabel?: string
  disabled?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  className?: string
}

/** Compact page-number strip: 1 … 4 [5] 6 … 12, capped to 7 slots. */
function getPageItems(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }
  const middle = [page - 1, page, page + 1].filter((value) => value > 1 && value < pageCount)
  const items: Array<number | 'gap'> = [1]
  if ((middle[0] ?? pageCount) > 2) {
    items.push('gap')
  }
  items.push(...middle)
  if ((middle[middle.length - 1] ?? 1) < pageCount - 1) {
    items.push('gap')
  }
  items.push(pageCount)
  return items
}

/**
 * Standard admin pagination footer: "Showing X–Y of N", page controls and a
 * page-size selector. Purely presentational — the parent owns the URL state.
 */
export function PaginationControls({
  page,
  pageCount,
  totalCount,
  pageSize,
  itemLabel = 'item',
  disabled = false,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)
  const pageSizeItems = Object.fromEntries(
    ADMIN_QUESTION_PAGE_SIZES.map((size) => [String(size), `${size} per page`])
  )

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-sm text-muted-foreground">
        {totalCount === 0 ? (
          <>No {itemLabel}s</>
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{rangeStart}–{rangeEnd}</span> of{' '}
            <span className="font-medium text-foreground">{totalCount}</span> {itemLabel}
            {totalCount === 1 ? '' : 's'}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          items={pageSizeItems}
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Rows per page" disabled={disabled}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(pageSizeItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          {getPageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'ghost'}
                size="icon-sm"
                className="text-xs tabular-nums"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={disabled || page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
