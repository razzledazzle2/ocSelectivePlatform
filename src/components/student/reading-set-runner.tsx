'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import {
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  autosaveReadingAnswerAction,
  submitReadingSetAction,
} from '@/app/student/practice/reading/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { StudentQuestionReportButton } from '@/components/student/student-question-report-button'
import { cn } from '@/lib/utils'
import {
  type QuestionOptionLabel,
  type QuestionOptionRecord,
  type ReadingSessionData,
  type ReadingSet,
  type ReadingSetItem,
  type ReadingSetQuestionResult,
  type SharedOptionPool,
} from '@/lib/types'

interface ReadingSetRunnerProps {
  data: ReadingSessionData
  backHref: string
}

type ResultsBySet = Record<string, Record<string, ReadingSetQuestionResult>>

/** Seeds submitted-set results from the server payload (resume + refresh). */
function seedResults(data: ReadingSessionData): ResultsBySet {
  const seeded: ResultsBySet = {}
  for (const set of data.sets) {
    if (!set.isSubmitted) continue
    const byQuestion: Record<string, ReadingSetQuestionResult> = {}
    for (const item of set.items) {
      if (item.correctOptionLabel === null) continue
      byQuestion[item.question.id] = {
        questionId: item.question.id,
        selectedOptionLabel: item.savedAnswer,
        correctOptionLabel: item.correctOptionLabel,
        isCorrect: item.isCorrect === true,
        workedSolution: item.workedSolution ?? '',
      }
    }
    seeded[set.id] = byQuestion
  }
  return seeded
}

/** The shared A–G bank rendered as selectable option records. */
function poolAsOptions(pool: SharedOptionPool): QuestionOptionRecord[] {
  return pool.options.map((option, index) => ({
    label: option.label,
    option_text: option.text,
    sort_order: index + 1,
    asset: null,
  }))
}

export function ReadingSetRunner({ data, backHref }: ReadingSetRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, QuestionOptionLabel | null>>(() => {
    const initial: Record<string, QuestionOptionLabel | null> = {}
    for (const set of data.sets) {
      for (const item of set.items) {
        initial[item.question.id] = item.savedAnswer
      }
    }
    return initial
  })
  const [results, setResults] = useState<ResultsBySet>(() => seedResults(data))
  const [currentSetIndex, setCurrentSetIndex] = useState(() => {
    const firstOpen = data.sets.findIndex((set) => !set.isSubmitted)
    return firstOpen === -1 ? Math.max(0, data.sets.length - 1) : firstOpen
  })
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [passageOpen, setPassageOpen] = useState(true)
  const [isSubmitting, startSubmit] = useTransition()
  const questionStartedAt = useRef(Date.now())

  const currentSet = data.sets[currentSetIndex] as ReadingSet | undefined
  const items = currentSet?.items ?? []
  const currentItem = items[currentItemIndex] as ReadingSetItem | undefined
  const setResult = currentSet ? results[currentSet.id] : undefined
  const setSubmitted = Boolean(setResult)

  const allSubmitted = data.sets.length > 0 && data.sets.every((set) => Boolean(results[set.id]))

  const answeredInSet = items.filter((item) => answers[item.question.id]).length

  if (!currentSet || !currentItem) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          This reading session has no questions to show.
          <div className="mt-4">
            <Link className={buttonVariants({ variant: 'outline' })} href={backHref}>
              Back to practice
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isSharedBank = currentSet.setType === 'sentence_insertion' && Boolean(currentSet.sharedOptions)
  const options: QuestionOptionRecord[] =
    isSharedBank && currentSet.sharedOptions
      ? poolAsOptions(currentSet.sharedOptions)
      : currentItem.question.options

  // Which shared labels are already assigned to OTHER gaps in this set.
  const assignedElsewhere = new Map<QuestionOptionLabel, string>()
  if (isSharedBank) {
    for (const item of items) {
      if (item.question.id === currentItem.question.id) continue
      const label = answers[item.question.id]
      if (label) assignedElsewhere.set(label, item.targetLabel ?? `Q${item.position}`)
    }
  }

  const selected = answers[currentItem.question.id] ?? null
  const questionResult = setResult?.[currentItem.question.id]

  const persistAnswer = (label: QuestionOptionLabel) => {
    if (setSubmitted) return
    const next = selected === label ? null : label
    setAnswers((prev) => ({ ...prev, [currentItem.question.id]: next }))
    const elapsed = Math.round((Date.now() - questionStartedAt.current) / 1000)
    // Autosave in the background — a failure is non-fatal (state stays in memory).
    void autosaveReadingAnswerAction({
      sessionId: data.sessionId,
      questionId: currentItem.question.id,
      selectedOptionLabel: next,
      timeSpentSeconds: elapsed,
    }).then((result) => {
      if (!result.success) {
        toast.error(result.message ?? 'Could not save your answer.')
      }
    })
  }

  const goTo = (index: number) => {
    if (index < 0 || index >= items.length) return
    setCurrentItemIndex(index)
    questionStartedAt.current = Date.now()
  }

  const submitSet = () => {
    startSubmit(async () => {
      const result = await submitReadingSetAction({ sessionId: data.sessionId, setId: currentSet.id })
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to submit this set.')
        return
      }
      const byQuestion: Record<string, ReadingSetQuestionResult> = {}
      for (const questionResult of result.data.results) {
        byQuestion[questionResult.questionId] = questionResult
      }
      setResults((prev) => ({ ...prev, [currentSet.id]: byQuestion }))
      toast.success(`Set submitted — ${result.data.correctCount}/${result.data.totalQuestions} correct.`)
    })
  }

  const goToNextSet = () => {
    const nextOpen = data.sets.findIndex((set, index) => index > currentSetIndex && !results[set.id])
    const target = nextOpen === -1 ? currentSetIndex + 1 : nextOpen
    if (target < data.sets.length) {
      setCurrentSetIndex(target)
      setCurrentItemIndex(0)
      setPassageOpen(true)
      questionStartedAt.current = Date.now()
    }
  }

  const isLastSet = currentSetIndex >= data.sets.length - 1

  // ---- Overall results (all sets submitted) --------------------------------
  const overall = (() => {
    let correct = 0
    let total = 0
    for (const set of data.sets) {
      const byQuestion = results[set.id]
      if (!byQuestion) continue
      for (const questionResult of Object.values(byQuestion)) {
        total += 1
        if (questionResult.isCorrect) correct += 1
      }
    }
    return { correct, total }
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpenIcon className="size-4" />
          <span>
            Passage {currentSetIndex + 1} of {data.sets.length}
          </span>
          <span aria-hidden>·</span>
          <span>{data.subjectName} reading practice</span>
        </div>
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={backHref}>
          Save &amp; exit
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Passage — sticky beside the questions on desktop, collapsible on mobile. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold text-foreground">{currentSet.title}</p>
            <Button variant="ghost" size="sm" onClick={() => setPassageOpen((open) => !open)}>
              {passageOpen ? 'Hide passage' : 'Show passage'}
            </Button>
          </div>
          <div className={cn(!passageOpen && 'hidden lg:block')}>
            {currentSet.stimulus ? (
              <StimulusPanel stimulus={currentSet.stimulus} subjectName={data.subjectName} />
            ) : (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  This set has no passage attached.
                </CardContent>
              </Card>
            )}
            {currentSet.instructions ? (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {currentSet.instructions}
              </p>
            ) : null}
          </div>
        </div>

        {/* Question / gap column */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">
                Question {currentItemIndex + 1} of {items.length}
                {currentItem.targetLabel ? (
                  <span className="ml-2 text-muted-foreground">· Gap {currentItem.targetLabel}</span>
                ) : null}
              </CardTitle>
              <Badge variant={setSubmitted ? 'secondary' : 'outline'}>
                {setSubmitted ? 'Submitted' : `${answeredInSet}/${items.length} answered`}
              </Badge>
            </div>
            {/* Progress dots: answered / unanswered / correctness after submit. */}
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="Question progress">
              {items.map((item, index) => {
                const itemResult = setResult?.[item.question.id]
                const isAnswered = Boolean(answers[item.question.id])
                return (
                  <button
                    key={item.question.id}
                    type="button"
                    role="listitem"
                    aria-current={index === currentItemIndex}
                    aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ', not answered'}`}
                    onClick={() => goTo(index)}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                      index === currentItemIndex && 'ring-2 ring-brand ring-offset-1',
                      itemResult
                        ? itemResult.isCorrect
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-amber-300 bg-amber-50 text-amber-700'
                        : isAnswered
                          ? 'border-brand bg-brand-soft text-foreground'
                          : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    {itemResult ? (
                      itemResult.isCorrect ? (
                        <CheckCircle2Icon className="size-4" />
                      ) : (
                        <XCircleIcon className="size-4" />
                      )
                    ) : (
                      index + 1
                    )}
                  </button>
                )
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <QuestionMarkdown
              text={currentItem.question.questionText}
              className="text-base leading-8 text-foreground"
            />
            {currentItem.question.questionAssets.length ? (
              <div className="space-y-3">
                {currentItem.question.questionAssets.map((asset) => (
                  <QuestionAsset key={asset.id} asset={asset} />
                ))}
              </div>
            ) : null}

            {isSharedBank ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Choose a sentence for this gap from the shared bank
              </p>
            ) : null}

            <div className="grid gap-3">
              {options.map((option) => {
                const isSelected = selected === option.label
                const revealCorrect = questionResult?.correctOptionLabel === option.label
                const revealWrong =
                  questionResult && isSelected && questionResult.correctOptionLabel !== option.label
                const usedElsewhere = assignedElsewhere.get(option.label)

                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={setSubmitted}
                    aria-pressed={isSelected}
                    onClick={() => persistAnswer(option.label)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                      'border-border bg-card hover:bg-muted/50 disabled:cursor-default',
                      isSelected && !setSubmitted && 'border-brand bg-brand-soft text-foreground',
                      revealCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                      revealWrong && 'border-amber-300 bg-amber-50 text-amber-950'
                    )}
                  >
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {option.label}
                    </span>
                    <span className="flex-1">
                      <QuestionOptionContent option={option} />
                      {isSharedBank && usedElsewhere && !isSelected ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Currently used in {usedElsewhere}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Delayed feedback: revealed only after the whole set is submitted. */}
            {questionResult ? (
              <Alert variant={questionResult.isCorrect ? 'default' : 'destructive'}>
                {questionResult.isCorrect ? <CheckCircle2Icon /> : <XCircleIcon />}
                <AlertTitle>
                  {questionResult.isCorrect ? 'Correct!' : 'Not quite.'} The answer is{' '}
                  {questionResult.correctOptionLabel}.
                </AlertTitle>
                <AlertDescription>
                  {questionResult.workedSolution ? (
                    <QuestionMarkdown
                      text={questionResult.workedSolution}
                      className="mt-1 text-sm leading-7 text-foreground/80"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-foreground/80">No solution was added for this question yet.</p>
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentItemIndex === 0}
                onClick={() => goTo(currentItemIndex - 1)}
              >
                <ChevronLeftIcon className="size-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentItemIndex >= items.length - 1}
                onClick={() => goTo(currentItemIndex + 1)}
              >
                Next <ChevronRightIcon className="size-4" />
              </Button>
              <StudentQuestionReportButton
                questionId={currentItem.question.id}
                variant="ghost"
                className="ml-auto text-muted-foreground"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Set-level actions / result */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          {setSubmitted ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2Icon className="size-5 text-emerald-600" />
                <span className="font-medium text-foreground">
                  {Object.values(setResult ?? {}).filter((r) => r.isCorrect).length}/{items.length} correct
                </span>
                <span className="text-muted-foreground">on “{currentSet.title}”.</span>
              </div>
              {isLastSet ? (
                <Link className={buttonVariants()} href={backHref}>
                  Finish reading practice
                </Link>
              ) : (
                <Button onClick={goToNextSet}>
                  Next passage <ChevronRightIcon className="size-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {answeredInSet < items.length ? (
                  <>
                    <CircleIcon className="size-4" />
                    <span>
                      {items.length - answeredInSet} question{items.length - answeredInSet === 1 ? '' : 's'} still
                      unanswered — you can submit anyway.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="size-4 text-emerald-600" />
                    <span>All questions answered.</span>
                  </>
                )}
              </div>
              <Button onClick={submitSet} loading={isSubmitting} disabled={isSubmitting}>
                Submit set
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {allSubmitted ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Reading practice complete</AlertTitle>
          <AlertDescription>
            You scored {overall.correct}/{overall.total} across {data.sets.length} passage
            {data.sets.length === 1 ? '' : 's'}. Missed questions are now in Smart Revision.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
