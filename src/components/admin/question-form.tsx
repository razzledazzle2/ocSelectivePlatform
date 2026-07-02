'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { createQuestionAction, updateQuestionAction } from '@/app/admin/questions/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  type ActionResult,
  type QuestionFormValues,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'
import { toast } from 'sonner'

interface QuestionFormProps {
  mode: 'create' | 'edit'
  questionId?: string
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  initialValues: QuestionFormValues
}

const optionKeys = ['optionA', 'optionB', 'optionC', 'optionD'] as const
const difficultyValues = ['1', '2', '3', '4', '5'] as const

const emptyResult: ActionResult<{ redirectTo: string }> = {
  success: false,
  fieldErrors: {},
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs font-medium text-destructive">{message}</p>
}

export function QuestionForm({
  mode,
  questionId,
  subjects,
  topics,
  questionTypes,
  initialValues,
}: QuestionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<QuestionFormValues>(initialValues)
  const [result, setResult] = useState<ActionResult<{ redirectTo: string }>>(emptyResult)

  const filteredTopics = useMemo(
    () => topics.filter((topic) => topic.subject_id === values.subjectId),
    [topics, values.subjectId]
  )

  const filteredQuestionTypes = useMemo(() => {
    const byTopic = questionTypes.filter((questionType) => questionType.topic_id === values.topicId)
    if (values.topicId && byTopic.length > 0) {
      return byTopic
    }
    return questionTypes.filter((questionType) => questionType.subject_id === values.subjectId)
  }, [questionTypes, values.subjectId, values.topicId])

  function updateValue<Key extends keyof QuestionFormValues>(key: Key, value: QuestionFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubjectChange(nextSubjectId: string) {
    const nextTopics = topics.filter((topic) => topic.subject_id === nextSubjectId)
    const nextTopicId = nextTopics.some((topic) => topic.id === values.topicId)
      ? values.topicId
      : nextTopics[0]?.id ?? ''
    const nextTypes = questionTypes.filter(
      (questionType) => questionType.topic_id === nextTopicId || questionType.subject_id === nextSubjectId
    )

    setValues((current) => ({
      ...current,
      subjectId: nextSubjectId,
      topicId: nextTopicId,
      questionTypeId: nextTypes.some((questionType) => questionType.id === current.questionTypeId)
        ? current.questionTypeId
        : '',
    }))
  }

  function handleTopicChange(nextTopicId: string) {
    const nextTypes = questionTypes.filter(
      (questionType) => questionType.topic_id === nextTopicId || questionType.subject_id === values.subjectId
    )

    setValues((current) => ({
      ...current,
      topicId: nextTopicId,
      questionTypeId: nextTypes.some((questionType) => questionType.id === current.questionTypeId)
        ? current.questionTypeId
        : '',
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const actionResult =
        mode === 'create'
          ? await createQuestionAction(formData)
          : await updateQuestionAction(questionId ?? '', formData)

      setResult(actionResult)

      if (actionResult.success && actionResult.data?.redirectTo) {
        toast.success(actionResult.message ?? 'Question saved.')
        router.push(actionResult.data.redirectTo)
        router.refresh()
        return
      }

      toast.error(actionResult.message ?? 'Please fix the highlighted fields and try again.')
    })
  }

  const fieldErrors = result.fieldErrors ?? {}

  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{mode === 'create' ? 'New question' : 'Edit question'}</Badge>
          <Badge variant="secondary">Multiple choice</Badge>
        </div>
        <div>
          <CardTitle>{mode === 'create' ? 'Create a question' : 'Update question'}</CardTitle>
          <CardDescription>
            Add clear options, a reliable answer key, and enough explanation for students to learn from the result.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Hidden inputs mirror controlled Select state so the values are submitted with the form. */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="examType" value={values.examType} />
          <input type="hidden" name="subjectId" value={values.subjectId} />
          <input type="hidden" name="topicId" value={values.topicId} />
          <input type="hidden" name="questionTypeId" value={values.questionTypeId} />
          <input type="hidden" name="difficulty" value={values.difficulty} />
          <input type="hidden" name="status" value={values.status} />
          <input type="hidden" name="correctOptionLabel" value={values.correctOptionLabel} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Exam type</Label>
              <Select
                value={values.examType}
                onValueChange={(value) => updateValue('examType', value as QuestionFormValues['examType'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose exam type" />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((examType) => (
                    <SelectItem key={examType} value={examType}>
                      {examType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.examType} />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={values.subjectId} onValueChange={handleSubjectChange}>
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
              <FieldError message={fieldErrors.subjectId} />
            </div>

            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={values.topicId} onValueChange={handleTopicChange} disabled={!values.subjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTopics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.topicId} />
            </div>

            <div className="space-y-2">
              <Label>Question type</Label>
              <Select
                value={values.questionTypeId}
                onValueChange={(value) => updateValue('questionTypeId', value)}
                disabled={!values.subjectId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {filteredQuestionTypes.map((questionType) => (
                    <SelectItem key={questionType.id} value={questionType.id}>
                      {questionType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tagging the type powers precise analytics later (e.g. multi-step percentage problems).
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="yearLevel">Year level</Label>
              <Input
                id="yearLevel"
                name="yearLevel"
                type="number"
                min="3"
                max="12"
                value={values.yearLevel}
                onChange={(event) => updateValue('yearLevel', event.target.value)}
                placeholder="Optional"
              />
              <FieldError message={fieldErrors.yearLevel} />
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={values.difficulty} onValueChange={(value) => updateValue('difficulty', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {difficultyValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      Difficulty {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.difficulty} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={values.status}
                onValueChange={(value) => updateValue('status', value as QuestionFormValues['status'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.status} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="questionText">Question text</Label>
            <Textarea
              id="questionText"
              name="questionText"
              rows={4}
              value={values.questionText}
              onChange={(event) => updateValue('questionText', event.target.value)}
            />
            <FieldError message={fieldErrors.questionText} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passageText">Passage text</Label>
            <Textarea
              id="passageText"
              name="passageText"
              rows={5}
              value={values.passageText}
              onChange={(event) => updateValue('passageText', event.target.value)}
              placeholder="Optional passage or prompt"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Answer options</h2>
              <p className="mt-1 text-sm text-muted-foreground">Every question must have four options from A to D.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {optionKeys.map((optionKey) => {
                const label = optionKey.slice(-1) as 'A' | 'B' | 'C' | 'D'

                return (
                  <div key={label} className="space-y-2">
                    <Label htmlFor={optionKey}>Option {label}</Label>
                    <Input
                      id={optionKey}
                      name={optionKey}
                      value={values[optionKey]}
                      onChange={(event) => updateValue(optionKey, event.target.value)}
                    />
                    <FieldError message={fieldErrors[optionKey]} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Correct answer</Label>
              <Select
                value={values.correctOptionLabel}
                onValueChange={(value) =>
                  updateValue('correctOptionLabel', value as QuestionFormValues['correctOptionLabel'])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose the correct option" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_OPTION_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>
                      Option {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.correctOptionLabel} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortExplanation">Short explanation</Label>
              <Input
                id="shortExplanation"
                name="shortExplanation"
                value={values.shortExplanation}
                onChange={(event) => updateValue('shortExplanation', event.target.value)}
                placeholder="A quick explanation for instant feedback"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workedSolution">Worked solution</Label>
            <Textarea
              id="workedSolution"
              name="workedSolution"
              rows={6}
              value={values.workedSolution}
              onChange={(event) => updateValue('workedSolution', event.target.value)}
            />
            <FieldError message={fieldErrors.workedSolution} />
          </div>

          {result.message && !result.success ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save the question</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : mode === 'create' ? 'Create question' : 'Save changes'}
            </Button>
            <Link href="/admin/questions" className={cn(buttonVariants({ variant: 'outline' }))}>
              Cancel
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
