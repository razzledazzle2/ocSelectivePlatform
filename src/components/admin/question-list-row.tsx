'use client'

import Link from 'next/link'
import {
  ArchiveIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RocketIcon,
  RotateCcwIcon,
  SparklesIcon,
} from 'lucide-react'

import { QuestionStatusBadge } from '@/components/admin/question-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { OPTION_STATS_MIN_ATTEMPTS, type AdminQuestionListItem } from '@/lib/types'

const rowDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Compact real-attempt stats line. Percentages are held back until enough
 * attempts exist; with zero attempts it says so instead of showing 0%.
 */
function QuestionRowStats({ stats }: { stats: AdminQuestionListItem['stats'] }) {
  if (!stats) {
    return null
  }

  if (stats.totalAttempts === 0) {
    return <p className="text-xs text-muted-foreground/70">No attempts yet</p>
  }

  if (stats.totalAttempts < OPTION_STATS_MIN_ATTEMPTS) {
    return (
      <p className="text-xs text-muted-foreground/70">
        {stats.totalAttempts} attempt{stats.totalAttempts === 1 ? '' : 's'} · not enough data yet
      </p>
    )
  }

  const correctPct = Math.round((stats.accuracy ?? 0) * 100)
  const averageSeconds = Math.round(stats.averageTimeSeconds ?? 0)
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted-foreground">
      <span>{stats.totalAttempts} attempts</span>
      <span aria-hidden>·</span>
      <span className={correctPct < 40 ? 'font-medium text-warning' : 'text-success'}>
        {correctPct}% correct
      </span>
      <span aria-hidden>·</span>
      <span>{100 - correctPct}% wrong</span>
      <span aria-hidden>·</span>
      <span>{averageSeconds}s avg</span>
      {stats.reportCount > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span className="font-medium text-warning">
            {stats.reportCount} report{stats.reportCount === 1 ? '' : 's'}
          </span>
        </>
      ) : null}
    </p>
  )
}

interface QuestionListRowProps {
  question: AdminQuestionListItem
  isActive: boolean
  isChecked: boolean
  isBusy: boolean
  onSelect: () => void
  onCheckedChange: (checked: boolean) => void
  onPublishToggle: () => void
  onDuplicate: () => void
  onCreateSimilar: () => void
  onArchive: () => void
}

/** One scannable row in the question bank list; clicking it drives the preview pane. */
export function QuestionListRow({
  question,
  isActive,
  isChecked,
  isBusy,
  onSelect,
  onCheckedChange,
  onPublishToggle,
  onDuplicate,
  onCreateSimilar,
  onArchive,
}: QuestionListRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
        isActive
          ? 'border-brand/50 bg-brand-soft/50 shadow-sm ring-1 ring-brand/30'
          : 'border-transparent hover:bg-muted/50'
      )}
    >
      <input
        type="checkbox"
        aria-label={`Select question ${question.questionTextPreview.slice(0, 40)}`}
        className="mt-1 size-4 shrink-0 accent-primary"
        checked={isChecked}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <QuestionStatusBadge status={question.status} />
          <span className="text-xs text-muted-foreground">
            Updated {rowDateFormatter.format(new Date(question.updatedAt))}
          </span>
        </div>

        <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground">
          {question.questionTextPreview}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{question.subjectName}</span>
          <span aria-hidden>·</span>
          <span>{question.topicName}</span>
          {question.questionTypeName ? (
            <>
              <span aria-hidden>·</span>
              <span>{question.questionTypeName}</span>
            </>
          ) : null}
          <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem]">
            {question.examType}
          </Badge>
          <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
            D{question.difficulty}
          </Badge>
          <span>{question.optionsCount} opts</span>
          <span aria-hidden>·</span>
          <span>
            Ans <span className="font-semibold text-foreground/80">{question.correctOptionLabel}</span>
          </span>
        </div>

        <QuestionRowStats stats={question.stats} />
      </div>

      <div onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isBusy}
                className="text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
              />
            }
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Question actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              render={<Link href={`/admin/questions/${question.id}/edit`} />}
            >
              <PencilIcon className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={`/admin/questions/${question.id}/preview`} />}
            >
              <EyeIcon className="size-4" />
              Preview as student
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {question.status === 'published' ? (
              <DropdownMenuItem onClick={onPublishToggle}>
                <RotateCcwIcon className="size-4" />
                Unpublish
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onPublishToggle} disabled={question.status === 'archived'}>
                <RocketIcon className="size-4" />
                Publish
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <CopyIcon className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateSimilar}>
              <SparklesIcon className="size-4" />
              Create similar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={onArchive}
              disabled={question.status === 'archived'}
            >
              <ArchiveIcon className="size-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
