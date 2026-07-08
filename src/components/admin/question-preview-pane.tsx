'use client'

import Link from 'next/link'
import {
  ArchiveIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  MousePointerClickIcon,
  PencilIcon,
  RocketIcon,
  RotateCcwIcon,
  SparklesIcon,
} from 'lucide-react'

import { QuestionPreview } from '@/components/questions/question-preview'
import { QuestionAssetStatus } from '@/components/admin/question-asset-status'
import { QuestionStatsPanel } from '@/components/admin/question-stats-panel'
import { QuestionStatusBadge } from '@/components/admin/question-status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AdminQuestionListItem, QuestionDetail } from '@/lib/types'

const updatedFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

interface QuestionPreviewPaneProps {
  /** List item for the selected question (metadata that is available instantly). */
  item: AdminQuestionListItem | null
  /** Full detail once loaded; drives the student-style preview. */
  detail: QuestionDetail | null
  isLoading: boolean
  error: string | null
  isBusy: boolean
  onPublishToggle: () => void
  onDuplicate: () => void
  onCreateSimilar: () => void
  onArchive: () => void
  className?: string
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

/** Sticky right-hand pane that shows the selected question as a student would see it. */
export function QuestionPreviewPane({
  item,
  detail,
  isLoading,
  error,
  isBusy,
  onPublishToggle,
  onDuplicate,
  onCreateSimilar,
  onArchive,
  className,
}: QuestionPreviewPaneProps) {
  if (!item) {
    return (
      <div
        className={cn(
          'flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center',
          className
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <MousePointerClickIcon className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">Select a question to preview it</p>
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">
          Click any row on the left to see the full question, options, correct answer and worked
          solution exactly as a student would.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      {/* Pane header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Preview</h2>
          <QuestionStatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/questions/${item.id}/preview`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <EyeIcon className="size-3.5" />
            Preview as student
          </Link>
          <Link
            href={`/admin/questions/${item.id}/edit`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <PencilIcon className="size-3.5" />
            Edit
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-sm" disabled={isBusy} />}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">More actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {item.status === 'published' ? (
                <DropdownMenuItem onClick={onPublishToggle}>
                  <RotateCcwIcon className="size-4" />
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onPublishToggle} disabled={item.status === 'archived'}>
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
              <DropdownMenuItem
                variant="destructive"
                onClick={onArchive}
                disabled={item.status === 'archived'}
              >
                <ArchiveIcon className="size-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="font-mono text-[0.65rem] uppercase">
          ID {item.id.slice(0, 8)}
        </Badge>
        <Badge variant="outline">{item.examType}</Badge>
        <Badge variant="outline">{item.subjectName}</Badge>
        <Badge variant="outline">{item.topicName}</Badge>
        {item.questionTypeName ? <Badge variant="outline">{item.questionTypeName}</Badge> : null}
        <Badge variant="outline">Difficulty {item.difficulty}</Badge>
        <Badge variant="outline">{item.optionsCount} options</Badge>
      </div>

      {/* Student-style preview body */}
      {isLoading ? (
        <PreviewSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Preview unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : detail ? (
        <>
          <QuestionPreview question={detail} showStatus={false} showInstruction showMeta={false} />
          <QuestionAssetStatus assets={detail.assets} />
          {detail.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Tags:</span>
              {detail.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          <QuestionStatsPanel
            stats={item.stats}
            options={detail.options}
            correctOptionLabel={detail.correct_option_label}
          />
          <p className="text-xs text-muted-foreground">
            Last updated {updatedFormatter.format(new Date(detail.updated_at))}
          </p>
        </>
      ) : (
        <PreviewSkeleton />
      )}
    </div>
  )
}
