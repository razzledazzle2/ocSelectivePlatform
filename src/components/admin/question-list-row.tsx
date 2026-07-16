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
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react'

import { QuestionDeletedBadge, QuestionStatusBadge } from '@/components/admin/question-status-badge'
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
import { getDomainLabel, getSubtopicLabel } from '@/lib/taxonomy'
import { OPTION_STATS_MIN_ATTEMPTS, type AdminQuestionListItem } from '@/lib/types'

/**
 * Compact canonical-taxonomy line: a category (domain) badge with the subtopic
 * label beside it, so an admin can read a question's classification without
 * opening it. Renders nothing until a category is set. Labels wrap; raw codes are
 * never shown — an unknown code falls back to nothing rather than a slug.
 */
function QuestionRowTaxonomy({
  domainCode,
  subtopicCode,
}: {
  domainCode: string | null
  subtopicCode: string | null
}) {
  const categoryLabel = getDomainLabel(domainCode)
  if (!categoryLabel) {
    return null
  }
  const subtopicLabel = getSubtopicLabel(subtopicCode)
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <Badge variant="outline" className="h-4 border-brand/40 px-1.5 text-[0.65rem] text-brand">
        {categoryLabel}
      </Badge>
      {subtopicLabel ? (
        <span className="min-w-0 break-words text-muted-foreground">{subtopicLabel}</span>
      ) : (
        <span className="italic text-muted-foreground/70">No subtopic</span>
      )}
    </div>
  )
}

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
  onDelete: () => void
  onRestore: () => void
  onDeleteForever: () => void
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
  onDelete,
  onRestore,
  onDeleteForever,
}: QuestionListRowProps) {
  const isDeleted = Boolean(question.deletedAt)
  const canHardDelete = question.status === 'archived'
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
          : 'border-transparent hover:bg-muted/50',
        isDeleted && !isActive && 'opacity-60'
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
          {isDeleted ? <QuestionDeletedBadge /> : null}
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
          {question.assetState === 'pending' ? (
            <Badge variant="outline" className="h-4 border-amber-300 px-1.5 text-[0.65rem] text-amber-700">
              Pending asset
            </Badge>
          ) : null}
          <span>{question.optionsCount} opts</span>
          <span aria-hidden>·</span>
          <span>
            Ans <span className="font-semibold text-foreground/80">{question.correctOptionLabel}</span>
          </span>
        </div>

        <QuestionRowTaxonomy domainCode={question.domainCode} subtopicCode={question.subtopicCode} />

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
            {isDeleted ? (
              <>
                <DropdownMenuItem onClick={onRestore}>
                  <Undo2Icon className="size-4" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDeleteForever}>
                  <Trash2Icon className="size-4" />
                  Delete forever
                </DropdownMenuItem>
              </>
            ) : (
              <>
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
                  onClick={onArchive}
                  disabled={question.status === 'archived'}
                >
                  <ArchiveIcon className="size-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onDelete}
                  disabled={question.status !== 'archived'}
                >
                  <Trash2Icon className="size-4" />
                  Move to trash
                </DropdownMenuItem>
                {canHardDelete ? (
                  <DropdownMenuItem variant="destructive" onClick={onDeleteForever}>
                    <Trash2Icon className="size-4" />
                    Delete forever
                  </DropdownMenuItem>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
