'use client'

import { useState, useTransition } from 'react'

import { getBulkSelectionPreviewAction } from '@/app/admin/questions/bulk-actions'
import { Button } from '@/components/ui/button'
import type { AdminQuestionFilters, BulkSelectionPreview } from '@/lib/types'

interface SelectAllMatchingBannerProps {
  visibleCount: number
  totalCount: number
  filters: AdminQuestionFilters
  onSelectAllMatching: (preview: BulkSelectionPreview) => void
}

/**
 * Shown only once every row on the current page is checked and there are more
 * matching rows elsewhere. Fetches a server-authoritative count + cutoff
 * before handing control to allMatching mode — the browser never computes or
 * trusts its own idea of "how many match".
 */
export function SelectAllMatchingBanner({
  visibleCount,
  totalCount,
  filters,
  onSelectAllMatching,
}: SelectAllMatchingBannerProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (totalCount <= visibleCount) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-brand/20 bg-brand-soft/60 px-4 py-2 text-sm">
      <span className="text-foreground">
        All {visibleCount} question{visibleCount === 1 ? '' : 's'} on this page selected.
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-brand"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await getBulkSelectionPreviewAction(filters)
            if (result.success && result.data) {
              onSelectAllMatching(result.data)
            } else {
              setError(result.message ?? 'Unable to count matching questions.')
            }
          })
        }
      >
        {isPending ? 'Counting…' : `Select all ${totalCount} questions matching these filters`}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
