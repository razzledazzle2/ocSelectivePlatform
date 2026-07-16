import Link from 'next/link'
import { PlayIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { RevisionSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RevisionSummaryStripProps {
  summary: RevisionSummary
}

const TILES: Array<{ key: keyof RevisionSummary; label: string; tone: string }> = [
  { key: 'overdueCount', label: 'Overdue', tone: 'text-destructive' },
  { key: 'dueTodayCount', label: 'Due today', tone: 'text-warning' },
  { key: 'upcomingCount', label: 'Upcoming', tone: 'text-brand' },
  { key: 'almostMasteredCount', label: 'Almost mastered', tone: 'text-success' },
]

export function RevisionSummaryStrip({ summary }: RevisionSummaryStripProps) {
  const dueNow = summary.overdueCount + summary.dueTodayCount

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
          {TILES.map((tile) => (
            <div key={tile.key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </dt>
              <dd className={cn('text-2xl font-semibold tabular-nums', tile.tone)}>
                {summary[tile.key] as number}
              </dd>
            </div>
          ))}
        </dl>
        {dueNow > 0 ? (
          <Link
            href="/student/revision/session"
            className={cn(buttonVariants({ size: 'lg' }), 'shrink-0')}
          >
            <PlayIcon className="size-4" />
            Start revision session ({Math.min(dueNow, 10)})
          </Link>
        ) : (
          <p className="max-w-56 shrink-0 text-sm text-muted-foreground sm:text-right">
            Nothing due right now — new reviews unlock on schedule.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
