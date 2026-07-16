'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants, Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { RevisionRetryDialog } from '@/components/student/revision/retry-dialog'
import { explainReviewReason, formatDueStatus } from '@/lib/revision/format'
import { MISTAKE_STATUS_LABELS, type StudentMistakeQuestion } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NextReviewCardProps {
  mistake: StudentMistakeQuestion
}

export function NextReviewCard({ mistake }: NextReviewCardProps) {
  const router = useRouter()
  const [retryOpen, setRetryOpen] = useState(false)
  const now = Date.now()
  const due = formatDueStatus(mistake.status, mistake.nextReviewAt, now)

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Next review
        </CardTitle>
        <CardDescription>The most urgent question in your queue right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {mistake.subjectName ? <Badge variant="secondary">{mistake.subjectName}</Badge> : null}
          {mistake.topicName ? <Badge variant="outline">{mistake.topicName}</Badge> : null}
          {mistake.questionTypeName ? <Badge variant="outline">{mistake.questionTypeName}</Badge> : null}
          <Badge variant={due.tone === 'overdue' || due.tone === 'due' ? 'destructive' : 'outline'}>
            {due.label}
          </Badge>
          <Badge variant="outline">{MISTAKE_STATUS_LABELS[mistake.status]}</Badge>
        </div>

        <QuestionMarkdown text={mistake.questionText} className="text-lg leading-8 text-foreground" />

        <div className="grid gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p>{explainReviewReason(mistake.timesIncorrect, mistake.correctStreak)}</p>
          <p>
            Missed {mistake.timesIncorrect} time{mistake.timesIncorrect === 1 ? '' : 's'} · correct{' '}
            {mistake.timesCorrectAfterMistake} time{mistake.timesCorrectAfterMistake === 1 ? '' : 's'} since
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => setRetryOpen(true)}>
            <RotateCcwIcon className="size-4" />
            Retry question
          </Button>
          <Link
            href={`/student/revision/${mistake.questionId}`}
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Review previous solution
          </Link>
        </div>
      </CardContent>

      <RevisionRetryDialog
        questionId={mistake.questionId}
        open={retryOpen}
        onOpenChange={(open) => {
          setRetryOpen(open)
          if (!open) router.refresh()
        }}
      />
    </Card>
  )
}
