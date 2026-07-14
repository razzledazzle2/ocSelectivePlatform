'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { loadRevisionQuestionAction, retryMistakeAction } from '@/app/student/revision/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { OptionDistribution } from '@/components/student/option-distribution'
import { cn } from '@/lib/utils'
import {
  MISTAKE_STATUS_LABELS,
  type PracticeQuestionItem,
  type QuestionOptionLabel,
  type RevisionRetryFeedback,
} from '@/lib/types'

interface RevisionRetryDialogProps {
  questionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once with the graded result, right after a successful submission. */
  onSubmitted?: (feedback: RevisionRetryFeedback) => void
}

/**
 * The shared "retry this question" experience — a large, accessible dialog
 * (not an inline card) showing the full stimulus/options/diagrams, with no
 * answer reveal before submission. Used by both the Revision page's featured
 * Next-review card and its compact queue rows, so there is exactly one retry
 * implementation.
 */
export function RevisionRetryDialog({ questionId, open, onOpenChange, onSubmitted }: RevisionRetryDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [question, setQuestion] = useState<PracticeQuestionItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<RevisionRetryFeedback | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Loads (or reloads) the question whenever the dialog transitions to open.
  // Wired to the `open` prop directly rather than Base UI's onOpenChange —
  // that callback only fires for interactions the Dialog itself detects
  // (Escape, backdrop, an internal trigger); it never fires when a parent
  // outside the Dialog's tree flips `open` externally, which is exactly how
  // every caller here opens it (a plain button next to the Dialog).
  useEffect(() => {
    if (!open) return

    let cancelled = false
    setQuestion(null)
    setSelected('')
    setFeedback(null)
    setLoadError(null)
    setLoading(true)

    loadRevisionQuestionAction(questionId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.success && result.data) {
        setQuestion(result.data)
      } else {
        setLoadError(result.message ?? 'Unable to load this question.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [open, questionId])

  function submitRetry() {
    if (!selected || feedback || isPending) return

    startTransition(async () => {
      const result = await retryMistakeAction(questionId, selected)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to save your retry right now.')
        return
      }
      setFeedback(result.data)
      onSubmitted?.(result.data)
      toast.success(
        result.data.isCorrect
          ? `Correct! Status: ${MISTAKE_STATUS_LABELS[result.data.status]}.`
          : 'Saved. This question is back in your review queue.'
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Retry this question</DialogTitle>
          <DialogDescription>Answer again to move it towards mastered.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}

        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load the question</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        {question ? (
          <div className="space-y-4">
            {question.stimulus ? (
              <StimulusPanel stimulus={question.stimulus} subjectName={question.subjectName} />
            ) : question.passageText ? (
              <QuestionMarkdown
                text={question.passageText}
                className="rounded-xl border border-border bg-card px-3 py-3 text-base leading-7 text-foreground"
              />
            ) : null}
            <QuestionMarkdown
              text={question.questionText}
              className="text-base leading-7 text-foreground"
            />
            {question.questionAssets.length ? (
              <div className="space-y-3">
                {question.questionAssets.map((asset) => (
                  <QuestionAsset key={asset.id} asset={asset} />
                ))}
              </div>
            ) : null}

            <div className="grid gap-2">
              {question.options.map((option) => {
                const isSelected = selected === option.label
                const isCorrect = feedback?.correctOptionLabel === option.label
                const isWrong = Boolean(feedback && isSelected && feedback.correctOptionLabel !== option.label)

                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={Boolean(feedback)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                      'border-border bg-card hover:bg-muted/50 disabled:cursor-default',
                      isSelected && !feedback && 'border-brand bg-brand-soft text-foreground',
                      feedback && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                      isWrong && 'border-amber-300 bg-amber-50 text-amber-950'
                    )}
                    onClick={() => setSelected(option.label)}
                  >
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
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
                    {feedback.isCorrect ? 'Correct!' : 'Not quite.'} Correct answer: {feedback.correctOptionLabel}.
                  </AlertTitle>
                  <AlertDescription>
                    {feedback.workedSolution ? (
                      <QuestionMarkdown
                        text={feedback.workedSolution}
                        className="mt-1 text-sm leading-7 text-foreground/80"
                      />
                    ) : (
                      <p className="mt-1 text-sm leading-7 text-foreground/80">
                        No solution was added for this question yet.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
                <OptionDistribution
                  stats={feedback.optionStats}
                  options={question.options}
                  correctOptionLabel={feedback.correctOptionLabel}
                  selectedOptionLabel={selected || null}
                />
              </>
            ) : null}

            <div className="flex justify-end gap-2">
              {!feedback ? (
                <Button disabled={!selected || isPending} loading={isPending} onClick={submitRetry}>
                  {isPending ? 'Saving...' : 'Submit retry'}
                </Button>
              ) : (
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
