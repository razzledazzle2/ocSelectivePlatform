'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  CheckCircle2Icon,
  PartyPopperIcon,
  SparklesIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { retryMistakeAction } from '@/app/student/revision/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { OptionDistribution } from '@/components/student/option-distribution'
import { StudentQuestionReportButton } from '@/components/student/student-question-report-button'
import type { RevisionQueueItem } from '@/lib/revision/queries'
import { cn } from '@/lib/utils'
import {
  MISTAKE_STATUS_LABELS,
  type QuestionOptionLabel,
  type RevisionRetryFeedback,
} from '@/lib/types'

interface RevisionSessionRunnerProps {
  items: RevisionQueueItem[]
  totalDue: number
}

interface CompletedReview {
  item: RevisionQueueItem
  feedback: RevisionRetryFeedback
}

export function RevisionSessionRunner({ items, totalDue }: RevisionSessionRunnerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<RevisionRetryFeedback | null>(null)
  const [completed, setCompleted] = useState<CompletedReview[]>([])
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now())

  const current = items[currentIndex] ?? null
  const isDone = currentIndex >= items.length

  function submitAnswer() {
    if (!current || !selected || feedback || isPending) return

    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000))

    startTransition(async () => {
      const result = await retryMistakeAction(current.question.id, selected, timeTakenSeconds)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to save your answer right now.')
        return
      }
      setFeedback(result.data)
      setCompleted((existing) => [...existing, { item: current, feedback: result.data as RevisionRetryFeedback }])
    })
  }

  function goNext() {
    setCurrentIndex((index) => index + 1)
    setSelected('')
    setFeedback(null)
    setQuestionStartedAt(Date.now())
    if (currentIndex + 1 >= items.length) {
      router.refresh()
    }
  }

  // -- Finished --------------------------------------------------------------
  if (isDone || !current) {
    const correctCount = completed.filter((review) => review.feedback.isCorrect).length
    const masteredCount = completed.filter((review) => review.feedback.status === 'mastered').length
    const remainingDue = Math.max(0, totalDue - completed.length)

    return (
      <Card className="rounded-2xl border border-border shadow-card">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
            <PartyPopperIcon className="size-6" />
          </span>
          <div className="max-w-md space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              {completed.length > 0
                ? `Nice work — ${correctCount} of ${completed.length} correct`
                : 'Nothing due right now'}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {completed.length > 0 ? (
                <>
                  Every review pushes these questions closer to mastered
                  {masteredCount > 0 ? (
                    <> — and {masteredCount} just got there. 🎉</>
                  ) : (
                    '.'
                  )}{' '}
                  {remainingDue > 0
                    ? `${remainingDue} more question${remainingDue === 1 ? ' is' : 's are'} still due today.`
                    : 'Your revision queue is clear for today.'}
                </>
              ) : (
                'Mistakes you make during practice are scheduled here for spaced review.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {remainingDue > 0 ? (
              <Button onClick={() => window.location.reload()}>
                <TrendingUpIcon className="size-4" />
                Review {Math.min(remainingDue, 10)} more
              </Button>
            ) : (
              <Link href="/student/practice" className={cn(buttonVariants())}>
                <SparklesIcon className="size-4" />
                Start new practice
              </Link>
            )}
            <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
              Back to revision
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // -- Active review ----------------------------------------------------------
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{current.question.subjectName}</Badge>
          <Badge variant="outline">{current.question.topicName}</Badge>
          <Badge variant="outline">{MISTAKE_STATUS_LABELS[current.status]}</Badge>
          {current.correctStreak > 0 ? (
            <Badge variant="outline">Streak {current.correctStreak}</Badge>
          ) : null}
        </div>
        <CardTitle className="text-xl">
          Review {currentIndex + 1} of {items.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          {current.question.stimulus ? (
            <StimulusPanel
              stimulus={current.question.stimulus}
              subjectName={current.question.subjectName}
            />
          ) : current.question.passageText ? (
            <QuestionMarkdown
              text={current.question.passageText}
              className="rounded-xl border border-border bg-card px-4 py-4 text-base leading-7 text-foreground"
            />
          ) : null}
          <QuestionMarkdown
            text={current.question.questionText}
            className="text-lg leading-8 text-foreground"
          />
          {current.question.questionAssets.length ? (
            <div className="space-y-3">
              {current.question.questionAssets.map((asset) => (
                <QuestionAsset key={asset.id} asset={asset} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {current.question.options.map((option) => {
            const isSelected = selected === option.label
            const isCorrect = feedback?.correctOptionLabel === option.label
            const isWrongSelection = Boolean(
              feedback && isSelected && feedback.correctOptionLabel !== option.label
            )

            return (
              <button
                key={option.label}
                type="button"
                disabled={Boolean(feedback)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors',
                  'border-border bg-card hover:bg-muted/50 disabled:cursor-default',
                  isSelected && !feedback && 'border-brand bg-brand-soft text-foreground',
                  feedback && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                  isWrongSelection && 'border-amber-300 bg-amber-50 text-amber-950'
                )}
                onClick={() => setSelected(option.label)}
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {option.label}
                </span>
                <QuestionOptionContent option={option} />
              </button>
            )
          })}
        </div>

        {feedback ? (
          <>
            <Alert variant={feedback.isCorrect ? 'default' : 'destructive'}>
              {feedback.isCorrect ? <CheckCircle2Icon /> : <XCircleIcon />}
              <AlertTitle>
                {feedback.isCorrect
                  ? feedback.status === 'mastered'
                    ? 'Correct — this question is now mastered! 🎉'
                    : `Correct! Now: ${MISTAKE_STATUS_LABELS[feedback.status]}.`
                  : "Not this time — it'll come back tomorrow so you can nail it."}{' '}
                The correct answer is {feedback.correctOptionLabel}.
              </AlertTitle>
              <AlertDescription>
                <div className="mt-1 space-y-3 text-sm leading-7 text-foreground">
                  <div>
                    <p className="font-semibold text-foreground">Solution</p>
                    {feedback.workedSolution ? (
                      <QuestionMarkdown text={feedback.workedSolution} className="text-foreground/80" />
                    ) : (
                      <p className="text-foreground/80">
                        No solution was added for this question yet.
                      </p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            <OptionDistribution
              stats={feedback.optionStats}
              options={current.question.options}
              correctOptionLabel={feedback.correctOptionLabel}
              selectedOptionLabel={selected || null}
            />
          </>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!feedback ? (
            <Button disabled={isPending || !selected} loading={isPending} onClick={submitAnswer}>
              {isPending ? 'Saving…' : 'Submit answer'}
            </Button>
          ) : (
            <Button disabled={isPending} onClick={goNext}>
              {currentIndex + 1 >= items.length ? 'Finish session' : 'Next review'}
            </Button>
          )}
          <StudentQuestionReportButton
            questionId={current.question.id}
            variant="ghost"
            className="ml-auto text-muted-foreground"
          />
        </div>
      </CardContent>
    </Card>
  )
}
