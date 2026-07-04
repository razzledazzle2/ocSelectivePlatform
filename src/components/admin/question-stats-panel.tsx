'use client'

import { BarChart3Icon, ClockIcon, FlagIcon, UsersIcon } from 'lucide-react'

import {
  OPTION_STATS_MIN_ATTEMPTS,
  QUESTION_OPTION_LABELS,
  type AdminQuestionStats,
  type QuestionOptionLabel,
  type QuestionOptionRecord,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const lastAttemptFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatAverageTime(seconds: number | null): string {
  if (seconds === null) {
    return '—'
  }
  const rounded = Math.round(seconds)
  if (rounded < 60) {
    return `${rounded}s`
  }
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`
}

interface QuestionStatsPanelProps {
  stats: AdminQuestionStats | null
  /** The question's actual options so 0% rows still render (incl. option E). */
  options: QuestionOptionRecord[] | null
  correctOptionLabel: QuestionOptionLabel
  className?: string
}

/** Returns the most-picked WRONG option, or null without enough signal. */
function getCommonWrongAnswer(
  stats: AdminQuestionStats,
  correctOptionLabel: QuestionOptionLabel
): { label: QuestionOptionLabel; count: number } | null {
  let top: { label: QuestionOptionLabel; count: number } | null = null
  for (const label of QUESTION_OPTION_LABELS) {
    const count = stats.optionCounts[label] ?? 0
    if (count > 0 && label !== correctOptionLabel && (!top || count > top.count)) {
      top = { label, count }
    }
  }
  return top
}

/**
 * Real attempt statistics for the selected question. Renders honest empty
 * states: "No attempts yet" with zero data, and holds back percentages until
 * OPTION_STATS_MIN_ATTEMPTS attempts exist.
 */
export function QuestionStatsPanel({ stats, options, correctOptionLabel, className }: QuestionStatsPanelProps) {
  if (!stats || stats.totalAttempts === 0) {
    return (
      <div className={cn('rounded-xl border border-dashed border-border bg-muted/30 p-4', className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BarChart3Icon className="size-4 text-muted-foreground" />
          Student performance
        </div>
        <p className="mt-2 text-sm text-muted-foreground">No attempts yet.</p>
        {stats && stats.reportCount > 0 ? (
          <p className="mt-1 text-xs text-warning">
            {stats.reportCount} report{stats.reportCount === 1 ? '' : 's'} filed against this question.
          </p>
        ) : null}
      </div>
    )
  }

  const hasEnoughData = stats.totalAttempts >= OPTION_STATS_MIN_ATTEMPTS
  const correctPct = stats.accuracy === null ? null : Math.round(stats.accuracy * 100)
  const commonWrong = hasEnoughData ? getCommonWrongAnswer(stats, correctOptionLabel) : null
  const visibleLabels = options?.length
    ? options.map((option) => option.label)
    : QUESTION_OPTION_LABELS.filter((label) => (stats.optionCounts[label] ?? 0) > 0)

  return (
    <div className={cn('space-y-4 rounded-xl border border-border bg-muted/20 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BarChart3Icon className="size-4 text-muted-foreground" />
          Student performance
        </div>
        {stats.lastAttemptedAt ? (
          <span className="text-xs text-muted-foreground">
            Last attempted {lastAttemptFormatter.format(new Date(stats.lastAttemptedAt))}
          </span>
        ) : null}
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-card px-3 py-2 shadow-xs ring-1 ring-border/60">
          <p className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            <UsersIcon className="size-3" /> Attempts
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{stats.totalAttempts}</p>
        </div>
        <div className="rounded-lg bg-card px-3 py-2 shadow-xs ring-1 ring-border/60">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Correct</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-success">
            {hasEnoughData && correctPct !== null ? `${correctPct}%` : `${stats.correctAttempts}`}
          </p>
        </div>
        <div className="rounded-lg bg-card px-3 py-2 shadow-xs ring-1 ring-border/60">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Wrong</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-destructive">
            {hasEnoughData && correctPct !== null ? `${100 - correctPct}%` : `${stats.incorrectAttempts}`}
          </p>
        </div>
        <div className="rounded-lg bg-card px-3 py-2 shadow-xs ring-1 ring-border/60">
          <p className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            <ClockIcon className="size-3" /> Avg time
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatAverageTime(stats.averageTimeSeconds)}
          </p>
        </div>
      </div>

      {hasEnoughData ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Answer distribution</p>
          {visibleLabels.map((label) => {
            const count = stats.optionCounts[label] ?? 0
            const pct = Math.round((count / stats.totalAttempts) * 100)
            const isCorrect = label === correctOptionLabel
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-semibold',
                    isCorrect ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', isCorrect ? 'bg-success' : 'bg-brand/50')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
              </div>
            )
          })}
          {commonWrong ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Most common wrong answer:{' '}
              <span className="font-semibold text-foreground">Option {commonWrong.label}</span> (
              {commonWrong.count} of {stats.incorrectAttempts} wrong answers)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not enough data yet — percentages appear after {OPTION_STATS_MIN_ATTEMPTS} attempts (
          {stats.totalAttempts} so far).
        </p>
      )}

      {stats.reportCount > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FlagIcon className="size-3.5 text-gold" />
          {stats.reportCount} report{stats.reportCount === 1 ? '' : 's'} filed against this question.
        </p>
      ) : null}
    </div>
  )
}
