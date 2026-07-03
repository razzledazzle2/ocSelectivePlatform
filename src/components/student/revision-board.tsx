'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { AlarmClockIcon, BookOpenIcon, CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  loadRevisionQuestionAction,
  markUnderstoodAction,
  retryMistakeAction,
} from '@/app/student/revision/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StudentQuestionReportButton } from '@/components/student/student-question-report-button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  type PracticeQuestionItem,
  type QuestionOptionLabel,
  type RevisionMode,
  type RevisionRetryFeedback,
  type StudentMistakeQuestion,
} from '@/lib/types'

interface RevisionBoardProps {
  mistakes: StudentMistakeQuestion[]
}

const ALL = 'all'

const MODES: { value: RevisionMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due_today', label: 'Due today' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'learning', label: 'Learning' },
  { value: 'improving', label: 'Improving' },
  { value: 'mastered', label: 'Mastered' },
]

const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })

function isDue(mistake: StudentMistakeQuestion, now: number): boolean {
  return (
    mistake.status !== 'mastered' &&
    mistake.nextReviewAt !== null &&
    new Date(mistake.nextReviewAt).getTime() <= now
  )
}

function statusVariant(status: StudentMistakeQuestion['status']) {
  if (status === 'mastered') return 'default'
  if (status === 'needs_review') return 'destructive'
  return 'secondary'
}

function dueLabel(mistake: StudentMistakeQuestion, now: number): string {
  if (mistake.status === 'mastered') return 'Mastered'
  if (!mistake.nextReviewAt) return 'No review scheduled'
  const due = new Date(mistake.nextReviewAt).getTime()
  if (due <= now) return 'Due now'
  return `Due ${dateFormatter.format(new Date(mistake.nextReviewAt))}`
}

export function RevisionBoard({ mistakes }: RevisionBoardProps) {
  const [mode, setMode] = useState<RevisionMode>('all')
  const [subjectFilter, setSubjectFilter] = useState(ALL)
  const [topicFilter, setTopicFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)

  const now = Date.now()

  const subjectOptions = useMemo(
    () => Array.from(new Set(mistakes.map((m) => m.subjectName).filter(Boolean))) as string[],
    [mistakes]
  )
  const topicOptions = useMemo(
    () => Array.from(new Set(mistakes.map((m) => m.topicName).filter(Boolean))) as string[],
    [mistakes]
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(mistakes.map((m) => m.questionTypeName).filter(Boolean))) as string[],
    [mistakes]
  )

  const subjectItems = { [ALL]: 'All subjects', ...Object.fromEntries(subjectOptions.map((s) => [s, s])) }
  const topicItems = { [ALL]: 'All topics', ...Object.fromEntries(topicOptions.map((t) => [t, t])) }
  const typeItems = { [ALL]: 'All types', ...Object.fromEntries(typeOptions.map((t) => [t, t])) }

  const counts = useMemo(() => {
    return {
      all: mistakes.length,
      due_today: mistakes.filter((m) => isDue(m, now)).length,
      needs_review: mistakes.filter((m) => m.status === 'needs_review').length,
      learning: mistakes.filter((m) => m.status === 'learning').length,
      improving: mistakes.filter((m) => m.status === 'improving').length,
      mastered: mistakes.filter((m) => m.status === 'mastered').length,
    } satisfies Record<RevisionMode, number>
  }, [mistakes, now])

  const visibleMistakes = useMemo(() => {
    return mistakes.filter((mistake) => {
      if (mode === 'due_today' && !isDue(mistake, now)) return false
      if (mode !== 'all' && mode !== 'due_today' && mistake.status !== mode) return false
      if (subjectFilter !== ALL && mistake.subjectName !== subjectFilter) return false
      if (topicFilter !== ALL && mistake.topicName !== topicFilter) return false
      if (typeFilter !== ALL && mistake.questionTypeName !== typeFilter) return false
      return true
    })
  }, [mistakes, mode, subjectFilter, topicFilter, typeFilter, now])

  if (mistakes.length === 0) {
    return (
      <EmptyState
        icon={BookOpenIcon}
        title="No mistakes to review yet"
        description="When you answer a question incorrectly during practice, it is saved here so you can revise it and improve over time."
        action={
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
            Start practising
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      {counts.due_today > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <AlarmClockIcon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {counts.due_today} question{counts.due_today === 1 ? '' : 's'} due for review
              </p>
              <p className="text-xs text-muted-foreground">
                Regular revision moves knowledge from short-term to long-term memory.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setMode('due_today')}>
            Review now
          </Button>
        </div>
      ) : null}

      <Tabs value={mode} onValueChange={(value) => setMode(value as RevisionMode)}>
        <TabsList className="flex-wrap">
          {MODES.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label} ({counts[item.value]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={subjectFilter} onValueChange={setSubjectFilter} items={subjectItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {subjectOptions.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={topicFilter} onValueChange={setTopicFilter} items={topicItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All topics</SelectItem>
            {topicOptions.map((topic) => (
              <SelectItem key={topic} value={topic}>
                {topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter} items={typeItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {typeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visibleMistakes.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border shadow-none ring-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing matches this view right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleMistakes.map((mistake) => (
            <MistakeCard key={mistake.id} mistake={mistake} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

function MistakeCard({ mistake, now }: { mistake: StudentMistakeQuestion; now: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [retryOpen, setRetryOpen] = useState(false)

  function handleUnderstood() {
    startTransition(async () => {
      const result = await markUnderstoodAction(mistake.questionId)
      if (result.success) {
        toast.success(result.message ?? 'Marked as understood.')
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {mistake.subjectName ? <Badge variant="secondary">{mistake.subjectName}</Badge> : null}
          {mistake.topicName ? <Badge variant="outline">{mistake.topicName}</Badge> : null}
          {mistake.questionTypeName ? <Badge variant="outline">{mistake.questionTypeName}</Badge> : null}
          <Badge variant={statusVariant(mistake.status)}>{mistake.status.replace('_', ' ')}</Badge>
          <Badge variant="outline">Missed {mistake.timesIncorrect}x</Badge>
          {mistake.correctStreak > 0 ? (
            <Badge variant="outline">Streak {mistake.correctStreak}</Badge>
          ) : null}
        </div>

        <p className="text-sm leading-7 text-foreground/80">{mistake.questionText}</p>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>{dueLabel(mistake, now)}</span>
          <span>Correct after mistake: {mistake.timesCorrectAfterMistake}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => setRetryOpen(true)}>
            <RotateCcwIcon className="size-3.5" />
            Retry
          </Button>
          <Link
            href={`/student/revision/${mistake.questionId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Read solution
          </Link>
          {mistake.status !== 'mastered' ? (
            <Button size="sm" variant="ghost" disabled={isPending} onClick={handleUnderstood}>
              Mark understood
            </Button>
          ) : null}
          <StudentQuestionReportButton
            questionId={mistake.questionId}
            variant="ghost"
            className="ml-auto text-muted-foreground"
          />
        </div>
      </CardContent>

      {retryOpen ? (
        <RetryDialog
          questionId={mistake.questionId}
          open={retryOpen}
          onOpenChange={(open) => {
            setRetryOpen(open)
            if (!open) {
              router.refresh()
            }
          }}
        />
      ) : null}
    </Card>
  )
}

interface RetryDialogProps {
  questionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RetryDialog({ questionId, open, onOpenChange }: RetryDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [question, setQuestion] = useState<PracticeQuestionItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<RevisionRetryFeedback | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function handleOpenChange(next: boolean) {
    onOpenChange(next)

    if (next && !question) {
      setLoading(true)
      setLoadError(null)
      const result = await loadRevisionQuestionAction(questionId)
      setLoading(false)
      if (result.success && result.data) {
        setQuestion(result.data)
      } else {
        setLoadError(result.message ?? 'Unable to load this question.')
      }
    }
  }

  function submitRetry() {
    if (!selected || feedback || isPending) return

    startTransition(async () => {
      const result = await retryMistakeAction(questionId, selected)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to save your retry right now.')
        return
      }
      setFeedback(result.data)
      toast.success(
        result.data.isCorrect
          ? `Correct! Status: ${result.data.status.replace('_', ' ')}.`
          : 'Saved. This question is back in your review queue.'
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <p className="text-base leading-7 text-foreground">{question.questionText}</p>
            {question.passageText ? (
              <div className="rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm leading-7 text-foreground/80">
                {question.passageText}
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
                    <span className="whitespace-normal leading-6">{option.option_text}</span>
                  </button>
                )
              })}
            </div>

            {feedback ? (
              <Alert variant={feedback.isCorrect ? 'default' : 'destructive'}>
                {feedback.isCorrect ? <CheckCircle2Icon /> : <XCircleIcon />}
                <AlertTitle>
                  {feedback.isCorrect ? 'Correct!' : 'Not quite.'} Correct answer: {feedback.correctOptionLabel}.
                </AlertTitle>
                <AlertDescription>
                  <p className="mt-1 text-sm leading-7 text-foreground/80">{feedback.workedSolution}</p>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              {!feedback ? (
                <Button disabled={!selected || isPending} onClick={submitRetry}>
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
