import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PracticeSessionSummary } from '@/lib/types'

interface PracticeSummaryProps {
  summary: PracticeSessionSummary
  onPracticeAgain: () => void
  onChangeFilters: () => void
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export function PracticeSummary({
  summary,
  onPracticeAgain,
  onChangeFilters,
}: PracticeSummaryProps) {
  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Session complete</Badge>
          <Badge variant="outline">{summary.accuracy}% accuracy</Badge>
        </div>
        <CardTitle>Practice summary</CardTitle>
        <CardDescription>
          Your results have been saved. Incorrect answers are already available in Revision.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-muted-foreground">Questions answered</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalQuestions}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm text-emerald-700">Correct</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-950">{summary.correctCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm text-amber-700">Incorrect</p>
            <p className="mt-2 text-3xl font-semibold text-amber-950">{summary.incorrectCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-muted-foreground">Time taken</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatSeconds(summary.totalTimeSeconds)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
            Review incorrect answers
          </Link>
          <button type="button" className={cn(buttonVariants({ variant: 'default' }))} onClick={onPracticeAgain}>
            Practise again
          </button>
          <button type="button" className={cn(buttonVariants({ variant: 'ghost' }))} onClick={onChangeFilters}>
            Change filters
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
