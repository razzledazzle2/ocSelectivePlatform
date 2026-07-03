'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  completePracticeSessionAction,
  savePracticeAttemptAction,
  startPracticeAction,
} from '@/app/student/practice/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  type AttemptFeedback,
  type ExamType,
  type PracticeQuestionItem,
  type QuestionOptionLabel,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface PracticeSessionProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
}

interface AnsweredQuestion {
  question: PracticeQuestionItem
  selectedLabel: QuestionOptionLabel
  feedback: AttemptFeedback
}

type Phase = 'setup' | 'active' | 'results'

const QUESTION_COUNT = '20'

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

export function PracticeSession({ subjects, topics }: PracticeSessionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [phase, setPhase] = useState<Phase>('setup')

  const [examType, setExamType] = useState<ExamType>('OC')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [emptyResult, setEmptyResult] = useState(false)

  const [sessionId, setSessionId] = useState('')
  const [sessionStartedAt, setSessionStartedAt] = useState(0)
  const [questionStartedAt, setQuestionStartedAt] = useState(0)
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null)
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([])

  const filteredTopics = useMemo(
    () => topics.filter((topic) => topic.subject_id === subjectId),
    [topics, subjectId]
  )
  const subjectItems = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )
  const topicItems = useMemo(
    () => Object.fromEntries(filteredTopics.map((topic) => [topic.id, topic.name])),
    [filteredTopics]
  )

  const activeQuestion = questions[currentIndex] ?? null
  const isLastQuestion = currentIndex >= questions.length - 1
  const canStart = Boolean(examType && subjectId && topicId)

  function handleSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    setTopicId('')
    setEmptyResult(false)
  }

  function startPractice() {
    const formData = new FormData()
    formData.set('examType', examType)
    formData.set('subjectId', subjectId)
    formData.set('topicId', topicId)
    formData.set('questionCount', QUESTION_COUNT)

    startTransition(async () => {
      const result = await startPracticeAction(formData)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start practice right now.')
        return
      }

      if (result.data.questions.length === 0 || !result.data.sessionId) {
        setEmptyResult(true)
        return
      }

      const now = Date.now()
      setSessionId(result.data.sessionId)
      setQuestions(result.data.questions)
      setAnswers([])
      setCurrentIndex(0)
      setSelectedOption('')
      setFeedback(null)
      setEmptyResult(false)
      setSessionStartedAt(now)
      setQuestionStartedAt(now)
      setPhase('active')
    })
  }

  function submitAnswer() {
    if (!activeQuestion || !selectedOption || feedback || isPending) {
      return
    }

    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000))
    const formData = new FormData()
    formData.set('sessionId', sessionId)
    formData.set('questionId', activeQuestion.id)
    formData.set('selectedOptionLabel', selectedOption)
    formData.set('timeTakenSeconds', String(timeTakenSeconds))

    startTransition(async () => {
      const result = await savePracticeAttemptAction(formData)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to save your answer right now.')
        return
      }

      setFeedback(result.data)
      setAnswers((current) => [
        ...current,
        { question: activeQuestion, selectedLabel: selectedOption, feedback: result.data as AttemptFeedback },
      ])
    })
  }

  function goToNextQuestion() {
    if (!isLastQuestion) {
      setCurrentIndex((current) => current + 1)
      setSelectedOption('')
      setFeedback(null)
      setQuestionStartedAt(Date.now())
      return
    }

    // Last question answered: persist the session summary, then show results.
    const totalQuestions = answers.length
    const correctCount = answers.filter((answer) => answer.feedback.isCorrect).length
    const incorrectCount = totalQuestions - correctCount
    const totalTimeSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000))
    const accuracy = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0

    startTransition(async () => {
      const result = await completePracticeSessionAction({
        sessionId,
        totalQuestions,
        correctCount,
        incorrectCount,
        accuracy,
        totalTimeSeconds,
      })

      if (!result.success) {
        toast.error(result.message ?? 'Unable to finish the session, but your answers were saved.')
      }

      setPhase('results')
      router.refresh()
    })
  }

  function resetToSetup() {
    setPhase('setup')
    setQuestions([])
    setAnswers([])
    setCurrentIndex(0)
    setSelectedOption('')
    setFeedback(null)
    setSessionId('')
  }

  // -- Setup ---------------------------------------------------------------
  if (phase === 'setup') {
    return (
      <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Practice filters</CardTitle>
          <CardDescription>Choose an exam type, subject and topic, then start practising.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Exam type</Label>
                  <Select value={examType} onValueChange={(value) => setExamType(value as ExamType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose exam type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={subjectId} onValueChange={handleSubjectChange} items={subjectItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select
                    value={topicId}
                    onValueChange={(value) => {
                      setTopicId(value)
                      setEmptyResult(false)
                    }}
                    disabled={!subjectId}
                    items={topicItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={subjectId ? 'Choose a topic' : 'Choose a subject first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTopics.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {emptyResult ? (
                <Alert>
                  <AlertTitle>No questions here yet</AlertTitle>
                  <AlertDescription>
                    There are no published questions for this topic and exam type yet. Try another topic or exam
                    type.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button disabled={!canStart || isPending} onClick={startPractice}>
                {isPending ? 'Starting...' : 'Start practice'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // -- Results -------------------------------------------------------------
  if (phase === 'results') {
    const totalQuestions = answers.length
    const correctCount = answers.filter((answer) => answer.feedback.isCorrect).length
    const incorrectCount = totalQuestions - correctCount
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const totalTimeSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000))
    const incorrectAnswers = answers.filter((answer) => !answer.feedback.isCorrect)

    return (
      <div className="space-y-6">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Practice results</CardTitle>
            <CardDescription>Your answers were saved. Here is how this set went.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {correctCount}/{totalQuestions}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Accuracy</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{accuracy}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Incorrect</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{incorrectCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{formatSeconds(totalTimeSeconds)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={startPractice}>
                <RotateCcwIcon className="size-4" />
                Practise again
              </Button>
              <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
                Review mistakes
              </Link>
              <Button variant="ghost" onClick={resetToSetup}>
                Change filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {incorrectAnswers.length > 0 ? (
          <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Questions to review</CardTitle>
              <CardDescription>
                These went into your revision queue. Compare your answer with the correct one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {incorrectAnswers.map((answer) => (
                <div key={answer.question.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium leading-7 text-slate-950">{answer.question.questionText}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="text-amber-700">Your answer: {answer.selectedLabel}</span>
                    <span className="text-emerald-700">Correct answer: {answer.feedback.correctOptionLabel}</span>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Worked solution
                  </p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">{answer.feedback.workedSolution}</p>
                  <div className="mt-2 flex justify-end">
                    <StudentQuestionReportButton
                      questionId={answer.question.id}
                      variant="ghost"
                      className="text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Perfect set!</AlertTitle>
            <AlertDescription>You answered every question correctly. Nothing to review here.</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // -- Active --------------------------------------------------------------
  if (!activeQuestion) {
    return null
  }

  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{activeQuestion.examType}</Badge>
          <Badge variant="secondary">{activeQuestion.subjectName}</Badge>
          <Badge variant="outline">{activeQuestion.topicName}</Badge>
          {activeQuestion.questionTypeName ? (
            <Badge variant="outline">{activeQuestion.questionTypeName}</Badge>
          ) : null}
          <Badge variant="outline">Difficulty {activeQuestion.difficulty}</Badge>
        </div>
        <CardTitle className="text-xl">
          Question {currentIndex + 1} of {questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <p className="text-lg leading-8 text-slate-950">{activeQuestion.questionText}</p>
          {activeQuestion.passageText ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
              {activeQuestion.passageText}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {activeQuestion.options.map((option) => {
            const isSelected = selectedOption === option.label
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
                  'border-slate-200 bg-white hover:bg-slate-50 disabled:cursor-default',
                  isSelected && !feedback && 'border-cyan-400 bg-cyan-50 text-cyan-950',
                  feedback && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                  isWrongSelection && 'border-amber-300 bg-amber-50 text-amber-950'
                )}
                onClick={() => setSelectedOption(option.label)}
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  {option.label}
                </span>
                <span className="whitespace-normal leading-7">{option.option_text}</span>
              </button>
            )
          })}
        </div>

        {feedback ? (
          <Alert variant={feedback.isCorrect ? 'default' : 'destructive'}>
            {feedback.isCorrect ? <CheckCircle2Icon /> : <XCircleIcon />}
            <AlertTitle>
              {feedback.isCorrect ? 'Correct!' : 'Not quite.'} The correct answer is {feedback.correctOptionLabel}.
            </AlertTitle>
            <AlertDescription>
              <div className="mt-1 space-y-3 text-sm leading-7 text-foreground">
                <div>
                  <p className="font-semibold text-slate-950">Short explanation</p>
                  <p className="text-slate-700">
                    {feedback.shortExplanation ?? 'No short explanation was added for this question yet.'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">Worked solution</p>
                  <p className="text-slate-700">{feedback.workedSolution}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!feedback ? (
            <Button disabled={isPending || !selectedOption} onClick={submitAnswer}>
              {isPending ? 'Saving...' : 'Submit answer'}
            </Button>
          ) : (
            <Button disabled={isPending} onClick={goToNextQuestion}>
              {isLastQuestion ? 'See results' : 'Next question'}
            </Button>
          )}
          <Button variant="ghost" onClick={resetToSetup}>
            Change filters
          </Button>
          <StudentQuestionReportButton
            questionId={activeQuestion.id}
            variant="ghost"
            className="ml-auto text-muted-foreground"
          />
        </div>
      </CardContent>
    </Card>
  )
}
