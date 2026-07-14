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
import {
  ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT,
  ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE,
  ADMIN_QUESTION_PAGE_SIZES,
} from '@/lib/types'
import { cn } from '@/lib/utils'

interface PaginationControlsProps {
  page: number
  pageCount: number
  totalCount: number
  pageSize: number
  /** Whether the current page size came from choosing "All". */
  isAllPageSize?: boolean
  /** Singular noun for the range summary, e.g. "question". */
  itemLabel?: string
  disabled?: boolean
  onPageChange: (page: number) => void
  /** Numeric sizes pass a number; choosing "All" passes the sentinel string. */
  onPageSizeChange: (pageSize: number | typeof ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE) => void
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
  isAllPageSize = false,
  itemLabel = 'item',
  disabled = false,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)
  const allAvailable = totalCount > 0 && totalCount <= ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT
  const allDescriptionId = 'pagination-all-page-size-hint'

  const pageSizeItems = {
    ...Object.fromEntries(ADMIN_QUESTION_PAGE_SIZES.map((size) => [String(size), `${size} per page`])),
    [ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE]: 'All',
  }
  const selectValue = isAllPageSize ? ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE : String(pageSize)

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
        <span id={allDescriptionId} className="sr-only">
          {allAvailable
            ? `Show all ${totalCount} matching ${itemLabel}s on one page.`
            : `"All" is only available when ${ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT} or fewer ${itemLabel}s match the current filters (currently ${totalCount}).`}
        </span>
        <Select
          value={selectValue}
          onValueChange={(value) =>
            onPageSizeChange(value === ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE ? ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE : Number(value))
          }
          items={pageSizeItems}
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Rows per page" disabled={disabled}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADMIN_QUESTION_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} per page
              </SelectItem>
            ))}
            <SelectItem
              value={ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE}
              disabled={!allAvailable}
              aria-describedby={allDescriptionId}
              title={
                allAvailable
                  ? undefined
                  : `All is only available when ${ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT} or fewer ${itemLabel}s match the current filters.`
              }
            >
              All
            </SelectItem>
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
