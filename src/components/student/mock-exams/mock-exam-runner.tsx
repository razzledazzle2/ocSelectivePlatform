'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
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
  submitMockExamAction,
} from '@/app/student/mock-exams/actions'
import type { MockExamRunnerData } from '@/lib/mock-exams/types'
import type { QuestionOptionLabel } from '@/lib/types'

interface MockExamRunnerProps {
  data: MockExamRunnerData
}

export function MockExamRunner({ data }: MockExamRunnerProps) {
  const router = useRouter()
  const questions = data.questions

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selections, setSelections] = useState<(QuestionOptionLabel | null)[]>(() =>
    questions.map((question) => question.selectedOptionLabel)
  )
  const [flags, setFlags] = useState<boolean[]>(() =>
    questions.map((question) => question.isFlagged)
  )
  const [submitOpen, setSubmitOpen] = useState(false)
  const [isSubmitting, startSubmitting] = useTransition()

  // When the current question was first shown, used to record time spent per question.
  const questionShownAtRef = useRef<number>(Date.now())
  const submittedRef = useRef(false)

  const currentQuestion = questions[currentIndex]
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
      void saveMockAnswerAction({ sessionId: data.sessionId, questionId, ...payload }).then(
        (result) => {
          if (!result.success) {
            toast.error(result.message ?? 'We could not save that answer. Check your connection.')
          }
        }
      )
    },
    [data.sessionId]
  )

  function handleSelect(label: QuestionOptionLabel) {
    setSelections((current) => {
      const next = [...current]
      next[currentIndex] = label
      return next
    })
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - questionShownAtRef.current) / 1000))
    persist(currentQuestion.id, { selectedOptionLabel: label, timeSpentSeconds })
  }

  function handleToggleFlag() {
    const nextFlag = !flags[currentIndex]
    setFlags((current) => {
      const next = [...current]
      next[currentIndex] = nextFlag
      return next
    })
    persist(currentQuestion.id, { isFlagged: nextFlag })
  }

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    questionShownAtRef.current = Date.now()
  }, [])

  const submit = useCallback(() => {
    if (submittedRef.current) {
      return
    }
    submittedRef.current = true

    startSubmitting(async () => {
      const result = await submitMockExamAction(data.sessionId)
      if (!result.success || !result.data) {
        submittedRef.current = false
        toast.error(result.message ?? 'Unable to submit your exam right now.')
        return
      }
      router.replace(`/student/mock-exams/${data.sessionId}/results`)
    })
  }, [data.sessionId, router])

  const handleExpire = useCallback(() => {
    if (submittedRef.current) {
      return
    }
    toast.info('Time is up — submitting your exam.')
    submit()
  }, [submit])

  if (!currentQuestion) {
    return null
  }

  const isLast = currentIndex >= questions.length - 1
  const isFirst = currentIndex <= 0

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{data.examType}</Badge>
            <span className="text-sm font-semibold text-foreground">{data.mockName}</span>
            {data.subjectName ? <Badge variant="secondary">{data.subjectName}</Badge> : null}
          </div>
          <MockExamTimer deadlineMs={data.deadlineMs} onExpire={handleExpire} />
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
                <Button
                  variant="outline"
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={isFirst}
                >
                  <ChevronLeftIcon className="size-4" />
                  Previous
                </Button>

                {isLast ? (
                  <Button onClick={() => setSubmitOpen(true)}>Review &amp; submit</Button>
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
                Submit exam
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
        onConfirm={submit}
      />
    </div>
  )
}
