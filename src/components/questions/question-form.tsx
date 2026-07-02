'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  createQuestionAction,
  updateQuestionAction,
} from '@/app/admin/questions/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  EXAM_TYPES,
  type ActionResult,
  type QuestionFormValues,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface QuestionFormProps {
  mode: 'create' | 'edit'
  questionId?: string
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  initialValues: QuestionFormValues
}

const selectClassName =
  'flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const optionKeys = ['optionA', 'optionB', 'optionC', 'optionD'] as const

const emptyResult: ActionResult<{ redirectTo: string }> = {
  success: false,
  fieldErrors: {},
}

function ErrorText({ message }: { message?: string }) {
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

  const filteredTopics = topics.filter((topic) => topic.subject_id === values.subjectId)
  const filteredQuestionTypes = values.topicId
    ? questionTypes.filter((questionType) => questionType.topic_id === values.topicId).length > 0
      ? questionTypes.filter((questionType) => questionType.topic_id === values.topicId)
      : questionTypes.filter((questionType) => questionType.subject_id === values.subjectId)
    : questionTypes.filter((questionType) => questionType.subject_id === values.subjectId)

  function updateValue<Key extends keyof QuestionFormValues>(key: Key, value: QuestionFormValues[Key]) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const actionResult =
        mode === 'create'
          ? await createQuestionAction(formData)
          : await updateQuestionAction(questionId ?? '', formData)

      setResult(actionResult)

      if (actionResult.success && actionResult.data?.redirectTo) {
        router.push(actionResult.data.redirectTo)
        router.refresh()
      }
    })
  }

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
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="examType">Exam type</Label>
              <select
                id="examType"
                name="examType"
                className={selectClassName}
                value={values.examType}
                onChange={(event) => updateValue('examType', event.target.value as QuestionFormValues['examType'])}
              >
                {EXAM_TYPES.map((examType) => (
                  <option key={examType} value={examType}>
                    {examType}
                  </option>
                ))}
              </select>
              <ErrorText message={result.fieldErrors?.examType} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjectId">Subject</Label>
              <select
                id="subjectId"
                name="subjectId"
                className={selectClassName}
                value={values.subjectId}
                onChange={(event) => {
                  const nextSubjectId = event.target.value
                  const nextTopics = topics.filter((topic) => topic.subject_id === nextSubjectId)
                  const nextTopicId = nextTopics.some((topic) => topic.id === values.topicId)
                    ? values.topicId
                    : nextTopics[0]?.id ?? ''
                  const nextQuestionTypes = questionTypes.filter(
                    (questionType) =>
                      questionType.topic_id === nextTopicId || questionType.subject_id === nextSubjectId
                  )

                  setValues((current) => ({
                    ...current,
                    subjectId: nextSubjectId,
                    topicId: nextTopicId,
                    questionTypeId: nextQuestionTypes.some(
                      (questionType) => questionType.id === current.questionTypeId
                    )
                      ? current.questionTypeId
                      : nextQuestionTypes[0]?.id ?? '',
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
              <ErrorText message={result.fieldErrors?.subjectId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicId">Topic</Label>
              <select
                id="topicId"
                name="topicId"
                className={selectClassName}
                value={values.topicId}
                onChange={(event) => {
                  const nextTopicId = event.target.value
                  const nextQuestionTypes = questionTypes.filter(
                    (questionType) =>
                      questionType.topic_id === nextTopicId || questionType.subject_id === values.subjectId
                  )

                  setValues((current) => ({
                    ...current,
                    topicId: nextTopicId,
                    questionTypeId: nextQuestionTypes.some(
                      (questionType) => questionType.id === current.questionTypeId
                    )
                      ? current.questionTypeId
                      : nextQuestionTypes[0]?.id ?? '',
                  }))
                }}
              >
                <option value="">Choose a topic</option>
                {filteredTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <ErrorText message={result.fieldErrors?.topicId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionTypeId">Question type</Label>
              <select
                id="questionTypeId"
                name="questionTypeId"
                className={selectClassName}
                value={values.questionTypeId}
                onChange={(event) => updateValue('questionTypeId', event.target.value)}
              >
                <option value="">Optional</option>
                {filteredQuestionTypes.map((questionType) => (
                  <option key={questionType.id} value={questionType.id}>
                    {questionType.name}
                  </option>
                ))}
              </select>
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
              />
              <ErrorText message={result.fieldErrors?.yearLevel} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                name="difficulty"
                className={selectClassName}
                value={values.difficulty}
                onChange={(event) => updateValue('difficulty', event.target.value)}
              >
                <option value="">Choose difficulty</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Difficulty {value}
                  </option>
                ))}
              </select>
              <ErrorText message={result.fieldErrors?.difficulty} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className={selectClassName}
                value={values.status}
                onChange={(event) => updateValue('status', event.target.value as QuestionFormValues['status'])}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <ErrorText message={result.fieldErrors?.status} />
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
            <ErrorText message={result.fieldErrors?.questionText} />
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
              <p className="mt-1 text-sm text-muted-foreground">
                Every question must have four options from A to D.
              </p>
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
                    <ErrorText message={result.fieldErrors?.[optionKey]} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="correctOptionLabel">Correct answer</Label>
              <select
                id="correctOptionLabel"
                name="correctOptionLabel"
                className={selectClassName}
                value={values.correctOptionLabel}
                onChange={(event) =>
                  updateValue(
                    'correctOptionLabel',
                    event.target.value as QuestionFormValues['correctOptionLabel']
                  )
                }
              >
                {(['A', 'B', 'C', 'D'] as const).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <ErrorText message={result.fieldErrors?.correctOptionLabel} />
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
            <ErrorText message={result.fieldErrors?.workedSolution} />
          </div>

          {result.message && !result.success ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {result.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : mode === 'create' ? 'Create question' : 'Save changes'}
            </Button>
            <Link
              href="/admin/questions"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Cancel
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
