'use client'

import Link from 'next/link'
import { CircleDashedIcon, ClockIcon } from 'lucide-react'

import { MasteryBar, MasteryStateBadge } from '@/components/student/mastery/mastery-visuals'
import { PracticeSessionSheet } from '@/components/student/learn/practice-session-sheet'
import { cn } from '@/lib/utils'
import type { LearnSubtopicRow } from '@/lib/learn/queries'
import type { ExamType } from '@/lib/types'

interface SubtopicPracticeCardProps {
  subtopic: LearnSubtopicRow
  examType: ExamType
  /** Href of the domain page, used as the runner's return target. */
  backHref: string
  /** Detail page link — mastery subjects only (practice-only have no detail). */
  detailHref?: string
}

function formatLastPractised(iso: string | null): string | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Practised today'
  if (days === 1) return 'Practised yesterday'
  if (days < 30) return `Practised ${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'Practised 1 month ago' : `Practised ${months} months ago`
}

export function SubtopicPracticeCard({ subtopic, examType, backHref, detailHref }: SubtopicPracticeCardProps) {
  const available = subtopic.availableQuestions > 0
  const started = (subtopic.attemptCount ?? 0) > 0
  const lastPractised = formatLastPractised(subtopic.lastPractisedAt)

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm transition-shadow sm:flex-row sm:items-center sm:gap-5',
        detailHref && 'hover:shadow-md'
      )}
    >
      {detailHref ? (
        <Link
          href={detailHref}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`View details for ${subtopic.subtopicLabel}`}
        />
      ) : null}

      <div className="pointer-events-none min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold text-foreground',
              detailHref && 'group-hover:text-brand'
            )}
          >
            {subtopic.subtopicLabel}
          </span>

          {subtopic.state ? (
            <MasteryStateBadge state={subtopic.state} size="sm" />
          ) : !available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <CircleDashedIcon className="size-3.5" aria-hidden />
              Questions coming soon
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              Ready to practise
            </span>
          )}
        </div>

        {/* Mastery bar only when there is a mastery model + a score. */}
        {subtopic.masteryPercent !== null ? (
          <MasteryBar
            percent={subtopic.masteryPercent}
            state={subtopic.state ?? 'learning'}
            className="max-w-sm"
          />
        ) : null}

        {/* Only render metrics that carry data — never rows of dashes. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {available ? (
            <span className="tabular-nums">{subtopic.availableQuestions} questions available</span>
          ) : null}
          {started ? (
            <span className="tabular-nums">
              {subtopic.attemptCount} answered
              {subtopic.recentAccuracy !== null ? ` · ${subtopic.recentAccuracy}% recent` : ''}
            </span>
          ) : null}
          {lastPractised ? (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" aria-hidden />
              {lastPractised}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 shrink-0">
        {available ? (
          <PracticeSessionSheet
            subtopicCode={subtopic.subtopicCode}
            subtopicLabel={subtopic.subtopicLabel}
            examType={examType}
            availableQuestions={subtopic.availableQuestions}
            backHref={backHref}
            triggerLabel={started ? 'Continue' : 'Practise'}
            triggerVariant={started ? 'outline' : 'default'}
          />
        ) : (
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-lg border border-dashed border-border px-3 text-xs font-medium text-muted-foreground'
            )}
          >
            No questions available yet
          </span>
        )}
      </div>
    </div>
  )
}
