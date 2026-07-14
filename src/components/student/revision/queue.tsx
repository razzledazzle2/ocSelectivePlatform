'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { loadMoreRevisionQueueAction } from '@/app/student/revision/actions'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RevisionQueueRow } from '@/components/student/revision/queue-row'
import type { RevisionQueueFilter, RevisionQueuePage, RevisionSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BookOpenIcon } from 'lucide-react'

interface RevisionQueueProps {
  initialFilter: RevisionQueueFilter
  initialPage: RevisionQueuePage
  summary: RevisionSummary
}

const FILTERS: Array<{ value: RevisionQueueFilter; label: string; countKey?: keyof RevisionSummary }> = [
  { value: 'due_now', label: 'Due now' },
  { value: 'overdue', label: 'Overdue', countKey: 'overdueCount' },
  { value: 'upcoming', label: 'Upcoming', countKey: 'upcomingCount' },
  { value: 'all', label: 'All', countKey: 'totalCount' },
  { value: 'mastered', label: 'Mastered', countKey: 'masteredCount' },
]

const EMPTY_COPY: Record<RevisionQueueFilter, string> = {
  due_now: 'Nothing due right now — new reviews unlock on schedule.',
  overdue: 'No overdue questions. You are caught up.',
  upcoming: 'Nothing scheduled in the next 7 days yet.',
  all: 'No mistakes tracked yet — they are saved here when you answer incorrectly during practice.',
  mastered: 'No mastered questions yet — four correct retries in a row will land a question here.',
}

export function RevisionQueue({ initialFilter, initialPage, summary }: RevisionQueueProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState(initialFilter)
  const [page, setPage] = useState(0)
  const [data, setData] = useState(initialPage)

  function switchFilter(next: RevisionQueueFilter) {
    if (next === filter) return
    startTransition(async () => {
      const result = await loadMoreRevisionQueueAction(next, 0)
      if (result.success && result.data) {
        setFilter(next)
        setPage(0)
        setData(result.data)
      } else {
        toast.error(result.message ?? 'Unable to load that view right now.')
      }
    })
  }

  function loadMore() {
    startTransition(async () => {
      const result = await loadMoreRevisionQueueAction(filter, page + 1)
      if (result.success && result.data) {
        setPage((value) => value + 1)
        setData((prev) => ({
          items: [...prev.items, ...result.data!.items],
          total: result.data!.total,
          hasMore: result.data!.hasMore,
        }))
      } else {
        toast.error(result.message ?? 'Unable to load more right now.')
      }
    })
  }

  function handleRowChanged() {
    router.refresh()
    startTransition(async () => {
      const result = await loadMoreRevisionQueueAction(filter, 0)
      if (result.success && result.data) {
        setPage(0)
        setData(result.data)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Revision queue filter" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = item.value === filter
          const count = item.countKey ? summary[item.countKey] : null
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchFilter(item.value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                active
                  ? 'border-transparent bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:bg-muted/60'
              )}
            >
              {item.label}
              {count !== null ? (
                <span className={cn('ml-1.5 tabular-nums', active ? 'text-background/70' : 'text-muted-foreground')}>
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {isPending && data.items.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={BookOpenIcon} title="Nothing here" description={EMPTY_COPY[filter]} />
      ) : (
        <div className="space-y-2">
          {data.items.map((mistake) => (
            <RevisionQueueRow key={mistake.id} mistake={mistake} onChanged={handleRowChanged} />
          ))}
        </div>
      )}

      {data.hasMore ? (
        <div className="flex justify-center pt-1">
          <Button variant="outline" disabled={isPending} loading={isPending} onClick={loadMore}>
            Load more ({data.items.length} of {data.total})
          </Button>
        </div>
      ) : null}
    </div>
  )
}
