'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDownIcon, RotateCcwIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { RemoveFromQueueDialog } from '@/components/student/revision/remove-from-queue-dialog'
import { RevisionRetryDialog } from '@/components/student/revision/retry-dialog'
import { formatDueStatus } from '@/lib/revision/format'
import { MISTAKE_STATUS_LABELS, type StudentMistakeQuestion } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RevisionQueueRowProps {
  mistake: StudentMistakeQuestion
  onChanged?: () => void
}

export function RevisionQueueRow({ mistake, onChanged }: RevisionQueueRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)
  const now = Date.now()
  const due = formatDueStatus(mistake.status, mistake.nextReviewAt, now)
  const preview =
    mistake.questionText.length > 90 ? `${mistake.questionText.slice(0, 90)}…` : mistake.questionText

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
          <span className="min-w-0 truncate text-sm text-foreground">{preview}</span>
        </button>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {mistake.subjectName ? <Badge variant="secondary">{mistake.subjectName}</Badge> : null}
          {mistake.topicName ? <Badge variant="outline">{mistake.topicName}</Badge> : null}
        </div>

        <Badge
          variant={due.tone === 'overdue' || due.tone === 'due' ? 'destructive' : 'outline'}
          className="shrink-0"
        >
          {due.label}
        </Badge>
        <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
          {MISTAKE_STATUS_LABELS[mistake.status]}
        </Badge>

        <Button size="sm" className="shrink-0" onClick={() => setRetryOpen(true)}>
          <RotateCcwIcon className="size-3.5" />
          Retry
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border/70 px-4 py-3">
          <p className="text-sm leading-6 text-foreground/80">{mistake.questionText}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="sm:hidden">
              {mistake.subjectName}
              {mistake.topicName ? ` — ${mistake.topicName}` : ''}
            </span>
            <span>Missed {mistake.timesIncorrect}x</span>
            <span>Correct after mistake: {mistake.timesCorrectAfterMistake}</span>
            {mistake.correctStreak > 0 ? <span>Current streak: {mistake.correctStreak}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/student/revision/${mistake.questionId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Read solution
            </Link>
            {mistake.status !== 'mastered' ? (
              <RemoveFromQueueDialog questionId={mistake.questionId} onRemoved={onChanged} />
            ) : null}
          </div>
        </div>
      ) : null}

      <RevisionRetryDialog
        questionId={mistake.questionId}
        open={retryOpen}
        onOpenChange={(open) => {
          setRetryOpen(open)
          if (!open) onChanged?.()
        }}
      />
    </div>
  )
}
