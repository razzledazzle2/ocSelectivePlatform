'use client'

import { useState, useTransition } from 'react'

import {
  completePracticeSessionAction,
  savePracticeAttemptAction,
  startPracticeAction,
} from '@/app/student/practice/actions'
import { AnswerFeedback } from '@/components/practice/answer-feedback'
import { PracticeSummary } from '@/components/practice/practice-summary'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  type AttemptFeedback,
  type PracticeQuestionItem,
  type PracticeSessionSummary,
  type QuestionOptionLabel,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface PracticePlayerProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
}

interface SessionState {
  sessionId: string
  startedAt: number
  questions: PracticeQuestionItem[]
}

interface PracticeFiltersState {
  examType: string
  subjectId: string
  topicId: string
  difficulty: string
  questionCount: string
}

interface AnswerRecord {
  questionId: string
  isCorrect: boolean
}

const selectClassName =
  'flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const initialFilters: PracticeFiltersState = {
  examType: 'OC',
  subjectId: '',
  topicId: '',
  difficulty: '',
  questionCount: '10',
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export function PracticePlayer({ subjects, topics }: PracticePlayerProps) {
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useState<PracticeFiltersState>({
    ...initialFilters,
    subjectId: subjects[0]?.id ?? '',
    topicId: topics.find((topic) => topic.subject_id === subjects[0]?.id)?.id ?? '',
  })
  const [session, setSession] = useState<SessionState | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null)
  const [results, setResults] = useState<AnswerRecord[]>([])
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null)
  const [summary, setSummary] = useState<PracticeSessionSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const filteredTopics = topics.filter((topic) => topic.subject_id === filters.subjectId)
  const activeQuestion = session?.questions[currentIndex] ?? null
  const answeredCount = results.length
  const correctCount = results.filter((result) => result.isCorrect).length
  const incorrectCount = answeredCount - correctCount

  function resetPracticeState() {
    setSession(null)
    setCurrentIndex(0)
    setSelectedOption('')
    setFeedback(null)
    setResults([])
    setQuestionStartedAt(null)
    setSummary(null)
  }

  function updateFilter<Key extends keyof PracticeFiltersState>(key: Key, value: PracticeFiltersState[Key]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function beginPractice() {
    const formData = new FormData()
    formData.set('examType', filters.examType)
    formData.set('subjectId', filters.subjectId)
    formData.set('topicId', filters.topicId)
    formData.set('difficulty', filters.difficulty)
    formData.set('questionCount', filters.questionCount)

    startTransition(async () => {
      const result = await startPracticeAction(formData)

      if (!result.success) {
        setMessage(result.message ?? 'Unable to start practice right now.')
        return
      }

      if (!result.data || result.data.questions.length === 0) {
        resetPracticeState()
        setMessage(result.message ?? 'No published questions match these filters yet.')
        return
      }

      setSession({
        sessionId: result.data.sessionId,
        startedAt: Date.now(),
        questions: result.data.questions,
      })
      setCurrentIndex(0)
      setSelectedOption('')
      setFeedback(null)
      setResults([])
      setQuestionStartedAt(Date.now())
      setSummary(null)
      setMessage(null)
    })
  }

  async function submitAnswer() {
    if (!session || !activeQuestion || !selectedOption || feedback) {
      return
    }

    const timeTakenSeconds = Math.max(
      1,
      Math.round(((Date.now() - (questionStartedAt ?? Date.now())) / 1000))
    )
    const formData = new FormData()
    formData.set('sessionId', session.sessionId)
    formData.set('questionId', activeQuestion.id)
    formData.set('selectedOptionLabel', selectedOption)
    formData.set('timeTakenSeconds', String(timeTakenSeconds))

    startTransition(async () => {
      const result = await savePracticeAttemptAction(formData)

      if (!result.success || !result.data) {
        setMessage(result.message ?? 'Unable to save your answer right now.')
        return
      }

      setFeedback(result.data as AttemptFeedback)
      setResults((current) => [
        ...current,
        {
          questionId: activeQuestion.id,
          isCorrect: result.data.isCorrect,
        },
      ])
      setMessage(null)
    })
  }

  async function goToNextQuestion() {
    if (!session) {
      return
    }

    const isLastQuestion = currentIndex >= session.questions.length - 1

    if (!isLastQuestion) {
      setCurrentIndex((current) => current + 1)
      setSelectedOption('')
      setFeedback(null)
      setQuestionStartedAt(Date.now())
      return
    }

    const completedResults = results
    const totalQuestions = completedResults.length
    const nextCorrectCount = completedResults.filter((result) => result.isCorrect).length
    const nextIncorrectCount = totalQuestions - nextCorrectCount
    const totalTimeSeconds = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000))
    const nextSummary: PracticeSessionSummary = {
      sessionId: session.sessionId,
      totalQuestions,
      correctCount: nextCorrectCount,
      incorrectCount: nextIncorrectCount,
      accuracy: totalQuestions > 0 ? Number(((nextCorrectCount / totalQuestions) * 100).toFixed(1)) : 0,
      totalTimeSeconds,
    }

    startTransition(async () => {
      const result = await completePracticeSessionAction(nextSummary)

      if (!result.success) {
        setMessage(result.message ?? 'Unable to finish the practice session right now.')
      }

      setSummary(nextSummary)
      setFeedback(null)
      setSelectedOption('')
      setSession(null)
      setMessage(result.message ?? null)
    })
  }

  if (summary) {
    return (
      <PracticeSummary
        summary={summary}
        onPracticeAgain={() => {
          setSummary(null)
          void beginPractice()
        }}
        onChangeFilters={() => {
          setSummary(null)
          resetPracticeState()
        }}
      />
    )
  }

  if (!session || !activeQuestion) {
    return (
      <div className="space-y-6">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Practice filters</CardTitle>
            <CardDescription>
              Choose the exam type, subject, topic, and difficulty you want to practise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="practice-exam-type">Exam type</Label>
                <select
                  id="practice-exam-type"
                  className={selectClassName}
                  value={filters.examType}
                  onChange={(event) => updateFilter('examType', event.target.value)}
                >
                  {EXAM_TYPES.map((examType) => (
                    <option key={examType} value={examType}>
                      {examType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="practice-subject">Subject</Label>
                <select
                  id="practice-subject"
                  className={selectClassName}
                  value={filters.subjectId}
                  onChange={(event) => {
                    const nextSubjectId = event.target.value
                    const nextTopicId =
                      topics.find((topic) => topic.subject_id === nextSubjectId)?.id ?? ''

                    setFilters((current) => ({
                      ...current,
                      subjectId: nextSubjectId,
                      topicId: nextTopicId,
                    }))
                  }}
                >
                  <option value="">Choose a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="practice-topic">Topic</Label>
                <select
                  id="practice-topic"
                  className={selectClassName}
                  value={filters.topicId}
                  onChange={(event) => updateFilter('topicId', event.target.value)}
                >
                  <option value="">Any topic</option>
                  {filteredTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="practice-difficulty">Difficulty</Label>
                <select
                  id="practice-difficulty"
                  className={selectClassName}
                  value={filters.difficulty}
                  onChange={(event) => updateFilter('difficulty', event.target.value)}
                >
                  <option value="">Any difficulty</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={String(value)}>
                      Difficulty {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="practice-question-count">Questions</Label>
                <select
                  id="practice-question-count"
                  className={selectClassName}
                  value={filters.questionCount}
                  onChange={(event) => updateFilter('questionCount', event.target.value)}
                >
                  {[5, 10, 15, 20].map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {message ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            ) : null}

            <Button disabled={isPending || !filters.subjectId} onClick={() => void beginPractice()}>
              {isPending ? 'Starting...' : 'Start practice'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progressLabel = `${currentIndex + 1} / ${session.questions.length}`
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000))

  return (
    <div className="space-y-6">
      <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{activeQuestion.examType}</Badge>
            <Badge variant="secondary">{activeQuestion.subjectName}</Badge>
            <Badge variant="outline">{activeQuestion.topicName}</Badge>
            {activeQuestion.questionTypeName ? (
              <Badge variant="outline">{activeQuestion.questionTypeName}</Badge>
            ) : null}
            <Badge variant="outline">Difficulty {activeQuestion.difficulty}</Badge>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Question {progressLabel}</CardTitle>
              <CardDescription>
                Correct {correctCount} • Incorrect {incorrectCount} • Time {formatSeconds(elapsedSeconds)}
              </CardDescription>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
              {answeredCount} answered so far
            </div>
          </div>
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
              const isWrongSelection =
                feedback && selectedOption === option.label && feedback.correctOptionLabel !== option.label

              return (
                <button
                  key={option.label}
                  type="button"
                  disabled={Boolean(feedback)}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-auto justify-start rounded-2xl px-4 py-4 text-left',
                    isSelected && 'border-cyan-400 bg-cyan-50 text-cyan-950',
                    feedback && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                    feedback && isWrongSelection && 'border-amber-300 bg-amber-50 text-amber-950'
                  )}
                  onClick={() => setSelectedOption(option.label)}
                >
                  <span className="mr-3 inline-flex size-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {option.label}
                  </span>
                  <span className="whitespace-normal leading-7">{option.option_text}</span>
                </button>
              )
            })}
          </div>

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          {feedback ? <AnswerFeedback feedback={feedback} /> : null}

          <div className="flex flex-wrap gap-3">
            {!feedback ? (
              <Button disabled={isPending || !selectedOption} onClick={() => void submitAnswer()}>
                {isPending ? 'Submitting...' : 'Submit answer'}
              </Button>
            ) : (
              <Button disabled={isPending} onClick={() => void goToNextQuestion()}>
                {isPending
                  ? 'Saving...'
                  : currentIndex >= session.questions.length - 1
                    ? 'Finish session'
                    : 'Next question'}
              </Button>
            )}
            <button
              type="button"
              className={cn(buttonVariants({ variant: 'ghost' }))}
              onClick={() => {
                setMessage(null)
                resetPracticeState()
              }}
            >
              Change filters
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
