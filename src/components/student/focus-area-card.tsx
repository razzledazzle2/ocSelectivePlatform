import Link from 'next/link'
import { TrendingDownIcon } from 'lucide-react'

import { formatAreaLabel } from '@/lib/dashboard/analysis'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WeakStrongInsights } from '@/lib/types'
import { cn } from '@/lib/utils'

interface FocusAreaCardProps {
  insights: WeakStrongInsights
}

/**
 * The Dashboard's single "one clear focus area" card — deeper strongest/weakest
 * comparisons live on the Progress page; this is just the one lowest-accuracy
 * area with a direct practice action.
 */
export function FocusAreaCard({ insights }: FocusAreaCardProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <TrendingDownIcon className="size-4" />
          </span>
          Focus area
        </CardTitle>
        <CardDescription>Your lowest-accuracy area right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!insights.hasEnoughData || !insights.weakest ? (
          <p className="text-sm text-muted-foreground">
            Keep practising across a few topics and your focus area will show here.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{formatAreaLabel(insights.weakest)}</p>
              <Badge variant="secondary">{insights.weakest.accuracy}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {insights.weakest.correct}/{insights.weakest.attempts} correct across recent attempts
            </p>
            <Link
              href="/student/practice"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
            >
              Practise this area
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
