import { UsersIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  OPTION_STATS_MIN_ATTEMPTS,
  type OptionStats,
  type QuestionOptionLabel,
  type QuestionOptionRecord,
} from '@/lib/types'

interface OptionDistributionProps {
  stats: OptionStats | null
  options: QuestionOptionRecord[]
  correctOptionLabel: QuestionOptionLabel
  selectedOptionLabel?: QuestionOptionLabel | null
  className?: string
}

/**
 * "How other students answered" bars. Only ever rendered AFTER the student has
 * answered — never show it beforehand, it would bias their choice. Falls back
 * to a clean message until enough real attempts exist; never fakes data.
 */
export function OptionDistribution({
  stats,
  options,
  correctOptionLabel,
  selectedOptionLabel,
  className,
}: OptionDistributionProps) {
  const heading = (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <UsersIcon className="size-3.5" />
      How students answered
    </p>
  )

  if (!stats || stats.totalAttempts < OPTION_STATS_MIN_ATTEMPTS) {
    return (
      <div className={cn('rounded-xl border border-dashed border-border px-3 py-3', className)}>
        {heading}
        <p className="mt-1.5 text-sm text-muted-foreground">Not enough student data yet.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border bg-muted/30 px-3 py-3', className)}>
      {heading}
      <div className="mt-2.5 space-y-1.5">
        {options.map((option) => {
          const count = stats.counts[option.label] ?? 0
          const percent = Math.round((count / stats.totalAttempts) * 100)
          const isCorrect = option.label === correctOptionLabel
          const isSelected = option.label === selectedOptionLabel

          return (
            <div key={option.label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  isCorrect ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {option.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', isCorrect ? 'bg-success' : 'bg-brand/40')}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-foreground/80">
                {percent}%
              </span>
              {isSelected ? (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  You
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Based on {stats.totalAttempts} student answer{stats.totalAttempts === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
