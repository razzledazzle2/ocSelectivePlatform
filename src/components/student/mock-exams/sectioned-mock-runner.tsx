'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, CoffeeIcon, PenLineIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MockExamQuestionCard } from '@/components/student/mock-exams/mock-exam-question-card'
import {
  MockExamQuestionNavigator,
  type NavigatorItem,
} from '@/components/student/mock-exams/mock-exam-question-navigator'
import { MockExamSubmitDialog } from '@/components/student/mock-exams/mock-exam-submit-dialog'
import { MockExamTimer } from '@/components/student/mock-exams/mock-exam-timer'
import {
  saveMockAnswerAction,
  saveWritingDraftAction,
  startNextMockSectionAction,
  submitMockSectionAction,
} from '@/app/student/mock-exams/actions'
import type {
  MockExamRunnerQuestion,
  MockExamSectionRow,
  SectionedMockRunnerData,
} from '@/lib/mock-exams/types'
import type { QuestionOptionLabel } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SectionedMockRunnerProps {
  data: SectionedMockRunnerData
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SectionedMockRunner({ data }: SectionedMockRunnerProps) {
  const router = useRouter()
  const sections = data.sections
  const activeSection = sections.find((section) => section.status === 'in_progress') ?? null
  const nextPending = sections.find((section) => section.status === 'pending') ?? null
  const finished = !activeSection && !nextPending

  useEffect(() => {
    if (finished || data.status !== 'in_progress') {
      router.replace(`/student/mock-exams/${data.sessionId}/results`)
    }
  }, [finished, data.status, data.sessionId, router])

  if (finished || data.status !== 'in_progress') {
    return null
  }

  return (
    <div className="space-y-5">
      <SectionStepper sections={sections} examType={data.examType} mockName={data.mockName} />

      {activeSection ? (
        activeSection.sectionKey === 'writing' ? (
          <WritingSection key={activeSection.id} data={data} section={activeSection} />
        ) : (
          <McqSection key={activeSection.id} data={data} section={activeSection} />
        )
      ) : nextPending ? (
        <BreakScreen data={data} sections={sections} nextSection={nextPending} />
      ) : null}
    </div>
  )
}

// -- Section progress header ---------------------------------------------------

function SectionStepper({
  sections,
  examType,
  mockName,
}: {
  sections: MockExamSectionRow[]
  examType: string
  mockName: string
}) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{examType}</Badge>
          <span className="text-sm font-semibold text-foreground">{mockName}</span>
        </div>
        <ol className="flex flex-wrap items-center gap-1.5">
          {sections.map((section, index) => {
            const isActive = section.status === 'in_progress'
            const isDone = section.status === 'submitted' || section.status === 'skipped'
            return (
              <li key={section.id} className="flex items-center gap-1.5">
                {index > 0 ? <span className="h-px w-3 bg-border" /> : null}
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    isActive && 'border-brand bg-brand-soft text-foreground',
                    isDone && 'border-success/40 bg-success-soft text-success',
                    !isActive && !isDone && 'border-border text-muted-foreground'
                  )}
                >
                  {isDone ? <CircleCheckIcon className="size-3" /> : null}
                  {section.name}
                </span>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

// -- Break screen ---------------------------------------------------------------

function BreakScreen({
  data,
  sections,
  nextSection,
}: {
  data: SectionedMockRunnerData
  sections: MockExamSectionRow[]
  nextSection: MockExamSectionRow
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const startedRef = useRef(false)

  // The break follows the most recently submitted section.
  const lastSubmitted = [...sections]
    .filter((section) => section.status === 'submitted' && section.submittedAt)
    .sort((a, b) => b.sectionOrder - a.sectionOrder)[0]

  const breakEndsMs = lastSubmitted?.submittedAt
    ? new Date(lastSubmitted.submittedAt).getTime() + (lastSubmitted.breakAfterSeconds ?? 0) * 1000
    : Date.now()

  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.ceil((breakEndsMs - Date.now()) / 1000)
  )

  const startNext = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true

    startTransition(async () => {
      const result = await startNextMockSectionAction(data.sessionId)
      if (!result.success) {
        startedRef.current = false
        toast.error(result.message ?? 'Unable to start the next section.')
        return
      }
      router.refresh()
    })
  }, [data.sessionId, router])

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.ceil((breakEndsMs - Date.now()) / 1000)
      setRemainingSeconds(next)
      if (next <= 0) {
        clearInterval(interval)
        startNext()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [breakEndsMs, startNext])

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gold-soft text-gold-foreground">
          <CoffeeIcon className="size-6" />
        </span>
        <div className="max-w-md space-y-1.5">
          <h2 className="text-xl font-semibold text-foreground">Break time</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Stretch, breathe, grab some water. <span className="font-medium text-foreground">{nextSection.name}</span>{' '}
            starts automatically when the break ends.
          </p>
        </div>
        <p className="text-4xl font-semibold tabular-nums text-foreground">
          {formatClock(remainingSeconds)}
        </p>
        <Button onClick={startNext} disabled={isPending}>
          {isPending ? 'Starting…' : 'Skip break — start ' + nextSection.name}
        </Button>
      </CardContent>
    </Card>
  )
}

// -- MCQ section -----------------------------------------------------------------

function McqSection({
  data,
  section,
}: {
  data: SectionedMockRunnerData
  section: MockExamSectionRow
}) {
  const router = useRouter()
  const questions = useMemo(
    () => data.questions.filter((question) => question.sectionId === section.id),
    [data.questions, section.id]
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selections, setSelections] = useState<(QuestionOptionLabel | null)[]>(() =>
    questions.map((question) => question.selectedOptionLabel)
  )
  const [flags, setFlags] = useState<boolean[]>(() => questions.map((question) => question.isFlagged))
  const [submitOpen, setSubmitOpen] = useState(false)
  const [isSubmitting, startSubmitting] = useTransition()

  const questionShownAtRef = useRef<number>(Date.now())
  const submittedRef = useRef(false)

  const deadlineMs = section.startedAt
    ? new Date(section.startedAt).getTime() + section.timeLimitSeconds * 1000
    : Date.now() + section.timeLimitSeconds * 1000

  const currentQuestion: (MockExamRunnerQuestion & { sectionId: string | null }) | undefined =
    questions[currentIndex]
  const answeredCount = selections.filter((value) => value !== null).length
  const flaggedCount = flags.filter(Boolean).length

  const navigatorItems: NavigatorItem[] = useMemo(
    () =>
      questions.map((_, index) => ({
        index,
        answered: selections[index] !== null,
        flagged: flags[index],
      })),
    [questions, selections, flags]
  )

  const persist = useCallback(
    (
      questionId: string,
      payload: { selectedOptionLabel?: string | null; isFlagged?: boolean; timeSpentSeconds?: number }
    ) => {
      void saveMockAnswerAction({ sessionId: data.sessionId, questionId, ...payload }).then((result) => {
        if (!result.success) {
          toast.error(result.message ?? 'We could not save that answer. Check your connection.')
        }
      })
    },
    [data.sessionId]
  )

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    questionShownAtRef.current = Date.now()
  }, [])

  const submitSection = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true

    startSubmitting(async () => {
      const result = await submitMockSectionAction({
        sessionId: data.sessionId,
        sectionId: section.id,
      })

      if (!result.success || !result.data) {
        submittedRef.current = false
        toast.error(result.message ?? 'Unable to submit this section right now.')
        return
      }

      setSubmitOpen(false)
      if (result.data.finished) {
        router.replace(`/student/mock-exams/${data.sessionId}/results`)
      } else {
        router.refresh()
      }
    })
  }, [data.sessionId, section.id, router])

  const handleExpire = useCallback(() => {
    if (submittedRef.current) return
    toast.info(`Time is up for ${section.name} — moving on.`)
    submitSection()
  }, [section.name, submitSection])

  if (!currentQuestion) {
    // A section with no questions (bank shortfall) is submitted straight through.
    return (
      <Card className="rounded-2xl border border-border shadow-card">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No questions are available for {section.name} yet.
          </p>
          <Button onClick={submitSection} disabled={isSubmitting}>
            Continue
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isLast = currentIndex >= questions.length - 1
  const isFirst = currentIndex <= 0

  function handleSelect(label: QuestionOptionLabel) {
    setSelections((current) => {
      const next = [...current]
      next[currentIndex] = label
      return next
    })
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - questionShownAtRef.current) / 1000))
    persist(currentQuestion!.id, { selectedOptionLabel: label, timeSpentSeconds })
  }

  function handleToggleFlag() {
    const nextFlag = !flags[currentIndex]
    setFlags((current) => {
      const next = [...current]
      next[currentIndex] = nextFlag
      return next
    })
    persist(currentQuestion!.id, { isFlagged: nextFlag })
  }

  return (
    <>
      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{section.name}</Badge>
            <span className="text-sm text-muted-foreground">
              Section {section.sectionOrder} of {data.sections.length}
            </span>
          </div>
          <MockExamTimer deadlineMs={deadlineMs} onExpire={handleExpire} />
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <div className="min-w-0">
              <MockExamQuestionCard
                question={currentQuestion}
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                selectedLabel={selections[currentIndex]}
                isFlagged={flags[currentIndex]}
                onSelect={handleSelect}
                onToggleFlag={handleToggleFlag}
              />

              <Separator className="my-6" />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={isFirst}>
                  <ChevronLeftIcon className="size-4" />
                  Previous
                </Button>

                {isLast ? (
                  <Button onClick={() => setSubmitOpen(true)}>Finish {section.name}</Button>
                ) : (
                  <Button onClick={() => goTo(currentIndex + 1)}>
                    Next
                    <ChevronRightIcon className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            <aside className="space-y-4 lg:border-l lg:border-border/70 lg:pl-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Questions
                </p>
                <p className="text-xs text-muted-foreground">
                  {answeredCount}/{questions.length} answered
                </p>
              </div>
              <MockExamQuestionNavigator
                items={navigatorItems}
                currentIndex={currentIndex}
                onSelect={goTo}
              />
              <Button className="w-full" onClick={() => setSubmitOpen(true)}>
                Submit section
              </Button>
            </aside>
          </div>
        </CardContent>
      </Card>

      <MockExamSubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        flaggedCount={flaggedCount}
        isSubmitting={isSubmitting}
        onConfirm={submitSection}
      />
    </>
  )
}

// -- Writing section ---------------------------------------------------------------

function WritingSection({
  data,
  section,
}: {
  data: SectionedMockRunnerData
  section: MockExamSectionRow
}) {
  const router = useRouter()
  const [response, setResponse] = useState(section.writingResponse ?? '')
  const [isSubmitting, startSubmitting] = useTransition()
  const submittedRef = useRef(false)
  const lastSavedRef = useRef(section.writingResponse ?? '')

  const deadlineMs = section.startedAt
    ? new Date(section.startedAt).getTime() + section.timeLimitSeconds * 1000
    : Date.now() + section.timeLimitSeconds * 1000

  const saveDraft = useCallback(() => {
    if (response === lastSavedRef.current) return
    lastSavedRef.current = response
    void saveWritingDraftAction({
      sessionId: data.sessionId,
      sectionId: section.id,
      writingResponse: response,
    })
  }, [data.sessionId, section.id, response])

  // Autosave the draft periodically so refreshes never lose work.
  useEffect(() => {
    const interval = setInterval(saveDraft, 10_000)
    return () => clearInterval(interval)
  }, [saveDraft])

  const finishSection = useCallback(
    (submitForMarking: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true

      startSubmitting(async () => {
        const result = await submitMockSectionAction({
          sessionId: data.sessionId,
          sectionId: section.id,
          writingResponse: response,
          writingSubmittedForMarking: submitForMarking,
        })

        if (!result.success || !result.data) {
          submittedRef.current = false
          toast.error(result.message ?? 'Unable to submit your writing right now.')
          return
        }

        toast.success(
          submitForMarking
            ? 'Writing submitted for marking.'
            : 'Draft saved — you can finish it later from your results page.'
        )

        if (result.data.finished) {
          router.replace(`/student/mock-exams/${data.sessionId}/results`)
        } else {
          router.refresh()
        }
      })
    },
    [data.sessionId, section.id, response, router]
  )

  const handleExpire = useCallback(() => {
    if (submittedRef.current) return
    toast.info('Time is up — saving your writing.')
    finishSection(true)
  }, [finishSection])

  const wordCount = response.trim() ? response.trim().split(/\s+/).length : 0

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Writing</Badge>
          <span className="text-sm text-muted-foreground">
            Section {section.sectionOrder} of {data.sections.length}
          </span>
        </div>
        <MockExamTimer deadlineMs={deadlineMs} onExpire={handleExpire} />
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PenLineIcon className="size-4 text-brand" />
            Writing task
          </p>
          <p className="mt-1.5 text-sm leading-7 text-foreground/80">
            Write a well-structured piece on the topic below. Plan for 5 minutes, write for the rest,
            and leave 2–3 minutes to check your work.
          </p>
          <p className="mt-2 text-sm font-medium leading-7 text-foreground">
            “A door you have never noticed before appears at your school. Write a story about what
            happens when it opens.”
          </p>
        </div>

        <div className="space-y-1.5">
          <textarea
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            onBlur={saveDraft}
            placeholder="Start writing here…"
            rows={16}
            className="w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors focus:border-brand"
          />
          <p className="text-right text-xs tabular-nums text-muted-foreground">{wordCount} words</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={isSubmitting} onClick={() => finishSection(false)}>
            Finish later
          </Button>
          <Button disabled={isSubmitting} onClick={() => finishSection(true)}>
            {isSubmitting ? 'Submitting…' : 'Submit for marking'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
