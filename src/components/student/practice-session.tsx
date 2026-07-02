'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { checkPracticeAnswerAction, loadPracticeQuestionsAction } from '@/app/student/practice/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  type ExamType,
  type PracticeAnswerFeedback,
  type PracticeQuestionItem,
  type QuestionOptionLabel,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface PracticeSessionProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
}

type Phase = 'setup' | 'active' | 'complete'

export function PracticeSession({ subjects, topics }: PracticeSessionProps) {
  const [isPending, startTransition] = useTransition()
  const [phase, setPhase] = useState<Phase>('setup')

  const [examType, setExamType] = useState<ExamType>('OC')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [emptyResult, setEmptyResult] = useState(false)

  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<QuestionOptionLabel | ''>('')
  const [feedback, setFeedback] = useState<PracticeAnswerFeedback | null>(null)

  const filteredTopics = useMemo(
    () => topics.filter((topic) => topic.subject_id === subjectId),
    [topics, subjectId]
  )

  // base-ui Select needs a value->label map so the trigger shows names, not raw ids.
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

    startTransition(async () => {
      const result = await loadPracticeQuestionsAction(formData)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start practice right now.')
        return
      }

      if (result.data.questions.length === 0) {
        setEmptyResult(true)
        return
      }

      setQuestions(result.data.questions)
      setCurrentIndex(0)
      setSelectedOption('')
      setFeedback(null)
      setEmptyResult(false)
      setPhase('active')
    })
  }

  function submitAnswer() {
    if (!activeQuestion || !selectedOption || feedback) {
      return
    }

    startTransition(async () => {
      const result = await checkPracticeAnswerAction(activeQuestion.id, selectedOption)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to check your answer right now.')
        return
      }

      setFeedback(result.data)
    })
  }

  function goToNextQuestion() {
    if (isLastQuestion) {
      setPhase('complete')
      return
    }

    setCurrentIndex((current) => current + 1)
    setSelectedOption('')
    setFeedback(null)
  }

  function backToSetup() {
    setPhase('setup')
    setQuestions([])
    setCurrentIndex(0)
    setSelectedOption('')
    setFeedback(null)
  }

  // -- Setup phase ---------------------------------------------------------
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
                    type, or check back once more questions are published.
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

  // -- Complete phase ------------------------------------------------------
  if (phase === 'complete') {
    return (
      <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Practice complete</CardTitle>
          <CardDescription>You have worked through all {questions.length} questions in this set.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Button
            onClick={() => {
              setCurrentIndex(0)
              setSelectedOption('')
              setFeedback(null)
              setPhase('active')
            }}
          >
            <RotateCcwIcon className="size-4" />
            Practise this set again
          </Button>
          <Button variant="outline" onClick={backToSetup}>
            Change filters
          </Button>
        </CardContent>
      </Card>
    )
  }

  // -- Active phase --------------------------------------------------------
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
        <div>
          <CardTitle className="text-xl">
            Question {currentIndex + 1} of {questions.length}
          </CardTitle>
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
              {isPending ? 'Checking...' : 'Submit answer'}
            </Button>
          ) : (
            <Button onClick={goToNextQuestion}>
              {isLastQuestion ? 'Finish' : 'Next question'}
            </Button>
          )}
          <Button variant="ghost" onClick={backToSetup}>
            Change filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
