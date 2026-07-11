'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  BrainIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
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
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { OptionDistribution } from '@/components/student/option-distribution'
import { StudentQuestionReportButton } from '@/components/student/student-question-report-button'
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  type AreaInsight,
  type AttemptFeedback,
  type ExamType,
  type PracticeQuestionItem,
  type PracticeSetMode,
  type QuestionOptionLabel,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

/** Aggregates from real attempt/mistake data that power the hub cards. */
export interface PracticeHubData {
  hasActivity: boolean
  revisionDueCount: number
  revisionTopAreas: string[]
  hasEnoughInsightData: boolean
  weakest: AreaInsight | null
  strongest: AreaInsight | null
}

/** A canonical subtopic the session is locked onto, from a Subtopic Mastery link. */
export interface SubtopicFocus {
  code: string
  label: string
  domainCode: string
}

interface PracticeSessionProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  hub: PracticeHubData
  /** Preselected via legacy topic deep links. */
  initialSubjectId?: string
  initialTopicId?: string
  /** When set, the set is built from this subtopic and the subject/topic filters are hidden. */
  subtopicFocus?: SubtopicFocus
}

interface AnsweredQuestion {
  question: PracticeQuestionItem
  selectedLabel: QuestionOptionLabel
  feedback: AttemptFeedback
}

type Phase = 'setup' | 'active' | 'results'

const SESSION_LENGTHS = ['5', '10', '20'] as const
const ANY_TOPIC = 'all'
const ANY_DIFFICULTY = 'any'

const MODE_OPTIONS: Array<{ value: PracticeSetMode; label: string; hint: string }> = [
  { value: 'new', label: 'New questions', hint: 'Questions you have not seen before' },
  { value: 'mistakes', label: 'Mistake review', hint: 'Only questions from your mistake bank' },
  { value: 'mixed', label: 'Mixed', hint: 'A blend of mistakes and new questions' },
]

/** Focused batch size the practice gate asks for before new practice. */
const GATE_BATCH_SIZE = 10

const DIFFICULTY_ITEMS: Record<string, string> = {
  [ANY_DIFFICULTY]: 'Any difficulty',
  '1': 'Difficulty 1 — gentle',
  '2': 'Difficulty 2',
  '3': 'Difficulty 3',
  '4': 'Difficulty 4',
  '5': 'Difficulty 5 — exam level',
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

export function PracticeSession({
  subjects,
  topics,
  hub,
  initialSubjectId,
  initialTopicId,
  subtopicFocus,
}: PracticeSessionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [phase, setPhase] = useState<Phase>('setup')

  const [examType, setExamType] = useState<ExamType>('OC')
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? '')
  const [topicId, setTopicId] = useState(initialTopicId ?? ANY_TOPIC)
  const [difficulty, setDifficulty] = useState(ANY_DIFFICULTY)
  const [questionCount, setQuestionCount] = useState<(typeof SESSION_LENGTHS)[number]>('10')
  const [setMode, setSetMode] = useState<PracticeSetMode>('new')
  const [gateSkipped, setGateSkipped] = useState(false)
  const [emptyResult, setEmptyResult] = useState(false)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

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
    () => ({
      [ANY_TOPIC]: 'All topics (recommended)',
      ...Object.fromEntries(filteredTopics.map((topic) => [topic.id, topic.name])),
    }),
    [filteredTopics]
  )

  const activeQuestion = questions[currentIndex] ?? null
  const isLastQuestion = currentIndex >= questions.length - 1
  const canStart = Boolean(examType && (subjectId || subtopicFocus))

  function handleSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    setTopicId(ANY_TOPIC)
    setEmptyResult(false)
  }

  function startPractice() {
    const formData = new FormData()
    formData.set('examType', examType)
    formData.set('questionCount', questionCount)

    if (subtopicFocus) {
      // Targeted practice: the subtopic replaces every other content filter.
      formData.set('subtopicCode', subtopicFocus.code)
    } else {
      formData.set('subjectId', subjectId)
      if (topicId !== ANY_TOPIC) {
        formData.set('topicId', topicId)
      }
      if (difficulty !== ANY_DIFFICULTY) {
        formData.set('difficulty', difficulty)
      }
      formData.set('mode', setMode)
    }

    startTransition(async () => {
      const result = await startPracticeAction(formData)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start practice right now.')
        return
      }

      if (result.data.questions.length === 0 || !result.data.sessionId) {
        setEmptyMessage(result.message ?? null)
        setEmptyResult(true)
        return
      }

      // A short or repetitive set is reported honestly rather than padded.
      if (result.message) {
        toast.info(result.message)
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

  // -- Setup: the Practice Hub ----------------------------------------------
  if (phase === 'setup') {
    const recommendedAreas = hub.revisionTopAreas.slice(0, 3).join(', ')
    const gateBatch = Math.min(hub.revisionDueCount, GATE_BATCH_SIZE)
    const gateActive = hub.revisionDueCount > 0 && !gateSkipped && setMode !== 'mistakes'

    return (
      <div className="space-y-5">
        {gateActive ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                You have {hub.revisionDueCount} mistake-review question
                {hub.revisionDueCount === 1 ? '' : 's'} due today. Complete{' '}
                {hub.revisionDueCount > GATE_BATCH_SIZE ? `a focused batch of ${gateBatch}` : 'them'}{' '}
                first to unlock new practice.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reviewing due questions first is the fastest way to turn mistakes into strengths.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/student/revision/session" className={cn(buttonVariants({ size: 'sm' }))}>
                Start revision ({gateBatch})
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setGateSkipped(true)}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* -- Recommended Today ---------------------------------------- */}
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-brand" />
                <CardTitle>Recommended today</CardTitle>
              </div>
              <CardDescription>Built from your mistakes and weak areas — it updates as you practise.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-between gap-4 pt-6">
              {hub.revisionDueCount > 0 ? (
                <>
                  <p className="text-sm leading-7 text-foreground/80">
                    You have <span className="font-semibold text-foreground">{hub.revisionDueCount} question{hub.revisionDueCount === 1 ? '' : 's'} ready to review</span>
                    {recommendedAreas ? (
                      <>
                        {' '}— mostly <span className="font-medium text-foreground">{recommendedAreas}</span>
                      </>
                    ) : null}
                    . Clearing these first is the fastest way to lift your accuracy.
                  </p>
                  <div>
                    <Link
                      href="/student/revision/session"
                      className={cn(buttonVariants({ variant: 'default' }))}
                    >
                      Start recommended practice
                    </Link>
                  </div>
                </>
              ) : hub.weakest ? (
                <>
                  <p className="text-sm leading-7 text-foreground/80">
                    Nothing is due for revision — nice. Your data says{' '}
                    <span className="font-medium text-foreground">
                      {[hub.weakest.subjectName, hub.weakest.topicName].filter(Boolean).join(' — ')}
                    </span>{' '}
                    is your weakest area ({hub.weakest.accuracy}% accuracy), so a focused set there is the best
                    use of today.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use Quick Practice on the right and pick that subject to target it.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-7 text-foreground/80">
                    Welcome! Start with a quick 10-question set — after a few sessions this card starts
                    recommending exactly what to practise next.
                  </p>
                  <p className="text-xs text-muted-foreground">Choose a subject on the right to begin.</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* -- Quick Practice -------------------------------------------- */}
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader className="border-b border-border/70">
              <CardTitle>{subtopicFocus ? 'Focused practice' : 'Quick practice'}</CardTitle>
              <CardDescription>
                {subtopicFocus
                  ? 'We build a varied set for this subtopic — different skills, different question styles.'
                  : 'Choose a subject and session length — we pick the questions.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : (
                <>
                  {subtopicFocus ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Practising
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">{subtopicFocus.label}</p>
                      </div>
                      <Link
                        href="/student/practice"
                        className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }))}
                      >
                        Clear focus
                      </Link>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
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

                    {subtopicFocus ? null : (
                      <>
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
                              <SelectValue placeholder={subjectId ? 'All topics' : 'Choose a subject first'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ANY_TOPIC}>All topics (recommended)</SelectItem>
                              {filteredTopics.map((topic) => (
                                <SelectItem key={topic.id} value={topic.id}>
                                  {topic.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Difficulty</Label>
                          <Select value={difficulty} onValueChange={setDifficulty} items={DIFFICULTY_ITEMS}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Any difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DIFFICULTY_ITEMS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Session length</Label>
                    <div className="flex gap-2">
                      {SESSION_LENGTHS.map((length) => (
                        <Button
                          key={length}
                          type="button"
                          size="sm"
                          variant={questionCount === length ? 'default' : 'outline'}
                          onClick={() => setQuestionCount(length)}
                        >
                          {length} questions
                        </Button>
                      ))}
                    </div>
                  </div>

                  {subtopicFocus ? (
                    <p className="text-xs text-muted-foreground">
                      Difficulty adapts to how you have been going here, and questions you have just seen are
                      held back.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <div className="flex flex-wrap gap-2">
                        {MODE_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="sm"
                            variant={setMode === option.value ? 'default' : 'outline'}
                            onClick={() => {
                              setSetMode(option.value)
                              setEmptyResult(false)
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {MODE_OPTIONS.find((option) => option.value === setMode)?.hint}
                      </p>
                    </div>
                  )}

                  {emptyResult ? (
                    <Alert>
                      <AlertTitle>No questions here yet</AlertTitle>
                      <AlertDescription>
                        {emptyMessage ??
                          'There are no published questions for these filters yet. Try another topic, difficulty or exam type.'}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    className="w-full"
                    disabled={!canStart || isPending || gateActive}
                    loading={isPending}
                    onClick={startPractice}
                  >
                    {isPending ? 'Building your set…' : 'Start practice'}
                  </Button>
                  {gateActive && canStart ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Clear your due revision first, or choose “Skip for now” above.
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* -- Weak areas / Revision due / Mock exams ----------------------- */}
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="size-4 text-brand" />
                <CardTitle className="text-base">Weak areas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {hub.hasEnoughInsightData && hub.weakest ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-sm font-medium text-amber-950">
                      {[hub.weakest.subjectName, hub.weakest.topicName].filter(Boolean).join(' — ')}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      {hub.weakest.accuracy}% accuracy over {hub.weakest.attempts} attempts
                    </p>
                  </div>
                  {hub.strongest ? (
                    <p className="text-xs text-muted-foreground">
                      Strongest: {[hub.strongest.subjectName, hub.strongest.topicName].filter(Boolean).join(' — ')}{' '}
                      ({hub.strongest.accuracy}%)
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete a few practice sessions to unlock weak-area recommendations.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BrainIcon className="size-4 text-brand" />
                <CardTitle className="text-base">Revision due</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold text-foreground">{hub.revisionDueCount}</p>
              <p className="text-sm text-muted-foreground">
                {hub.revisionDueCount === 0
                  ? 'Nothing due right now — mistakes you make in practice appear here for spaced review.'
                  : 'Mistake-review questions are due. Short, spaced reviews beat cramming.'}
              </p>
              <Link
                href="/student/revision"
                className={cn(buttonVariants({ variant: hub.revisionDueCount > 0 ? 'default' : 'outline', size: 'sm' }))}
              >
                Review mistakes
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TimerIcon className="size-4 text-brand" />
                <CardTitle className="text-base">Mock exams</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Timed, exam-style sessions with a full results breakdown at the end. Best once you are
                comfortable with a subject.
              </p>
              <Link href="/student/mock-exams" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Try a mock exam
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
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
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Practice results</CardTitle>
            <CardDescription>Your answers were saved. Here is how this set went.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {correctCount}/{totalQuestions}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Accuracy</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{accuracy}%</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Incorrect</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{incorrectCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatSeconds(totalTimeSeconds)}</p>
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
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Questions to review</CardTitle>
              <CardDescription>
                These went into your revision queue. Compare your answer with the correct one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {incorrectAnswers.map((answer) => (
                <div key={answer.question.id} className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                  <QuestionMarkdown
                    text={answer.question.questionText}
                    className="text-sm font-medium leading-7 text-foreground"
                  />
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="text-amber-700">Your answer: {answer.selectedLabel}</span>
                    <span className="text-emerald-700">Correct answer: {answer.feedback.correctOptionLabel}</span>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Worked solution
                  </p>
                  {answer.feedback.workedSolution ? (
                    <QuestionMarkdown
                      text={answer.feedback.workedSolution}
                      className="mt-1 text-sm leading-7 text-foreground/80"
                    />
                  ) : (
                    <p className="mt-1 text-sm leading-7 text-foreground/80">
                      No worked solution was added for this question yet.
                    </p>
                  )}
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
    <Card className="rounded-2xl shadow-sm ring-border">
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
          <QuestionMarkdown
            text={activeQuestion.questionText}
            className="text-lg leading-8 text-foreground"
          />
          {activeQuestion.stimulus ? (
            <StimulusPanel stimulus={activeQuestion.stimulus} />
          ) : activeQuestion.passageText ? (
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4 text-sm leading-7 text-foreground/80">
              {activeQuestion.passageText}
            </div>
          ) : null}
          {activeQuestion.questionAssets.length ? (
            <div className="space-y-3">
              {activeQuestion.questionAssets.map((asset) => (
                <QuestionAsset key={asset.id} asset={asset} />
              ))}
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
                  'border-border bg-card hover:bg-muted/50 disabled:cursor-default',
                  isSelected && !feedback && 'border-brand bg-brand-soft text-foreground',
                  feedback && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-950',
                  isWrongSelection && 'border-amber-300 bg-amber-50 text-amber-950'
                )}
                onClick={() => setSelectedOption(option.label)}
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
          <Alert variant={feedback.isCorrect ? 'default' : 'destructive'}>
            {feedback.isCorrect ? <CheckCircle2Icon /> : <XCircleIcon />}
            <AlertTitle>
              {feedback.isCorrect ? 'Correct!' : 'Not quite.'} The correct answer is {feedback.correctOptionLabel}.
            </AlertTitle>
            <AlertDescription>
              <div className="mt-1 space-y-3 text-sm leading-7 text-foreground">
                <div>
                  <p className="font-semibold text-foreground">Short explanation</p>
                  <p className="text-foreground/80">
                    {feedback.shortExplanation ?? 'No short explanation was added for this question yet.'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Worked solution</p>
                  {feedback.workedSolution ? (
                    <QuestionMarkdown text={feedback.workedSolution} className="text-foreground/80" />
                  ) : (
                    <p className="text-foreground/80">
                      No worked solution was added for this question yet.
                    </p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {feedback ? (
          <OptionDistribution
            stats={feedback.optionStats}
            options={activeQuestion.options}
            correctOptionLabel={feedback.correctOptionLabel}
            selectedOptionLabel={selectedOption || null}
          />
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!feedback ? (
            <Button disabled={isPending || !selectedOption} loading={isPending} onClick={submitAnswer}>
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
