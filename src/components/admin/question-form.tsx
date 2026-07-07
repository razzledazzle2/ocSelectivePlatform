'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'

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
import {
  checkOptionCount,
  getOptionRuleForSubject,
  labelsForCount,
  MAX_OPTION_COUNT,
} from '@/lib/questions/option-rules'
import { cn } from '@/lib/utils'
import {
  ANSWER_FORMAT_LABELS,
  ANSWER_FORMATS,
  EXAM_TYPES,
  type ActionResult,
  type QuestionFormValues,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'
import type { StimulusPickerItem } from '@/lib/stimuli/queries'
import { toast } from 'sonner'

interface QuestionFormProps {
  mode: 'create' | 'edit'
  questionId?: string
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  /** Stimuli available to link, fetched by the server page. */
  stimuli: StimulusPickerItem[]
  initialValues: QuestionFormValues
}

const difficultyValues = ['1', '2', '3', '4', '5'] as const

/** Sentinel for "no linked stimulus" (base-ui Select cannot use '' as a value). */
const NO_STIMULUS = 'none'

const RUBRIC_PLACEHOLDER = `{
  "textType": "persuasive",
  "criteria": [
    { "name": "Ideas & argument", "description": "Clear position with convincing reasons", "maxMarks": 10 },
    { "name": "Structure & cohesion", "maxMarks": 5 }
  ],
  "scoreBands": [
    { "band": "Top", "range": "13-15", "descriptor": "Sustained, persuasive and well organised" }
  ],
  "planningHints": ["State your position in the opening paragraph"]
}`

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
  stimuli,
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

  // base-ui Select needs value->label maps so triggers show names, not raw ids/values.
  const subjectItems = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )
  const topicItems = useMemo(
    () => Object.fromEntries(filteredTopics.map((topic) => [topic.id, topic.name])),
    [filteredTopics]
  )
  const questionTypeItems = useMemo(
    () => Object.fromEntries(filteredQuestionTypes.map((questionType) => [questionType.id, questionType.name])),
    [filteredQuestionTypes]
  )
  const difficultyItems = Object.fromEntries(difficultyValues.map((value) => [value, `Difficulty ${value}`]))
  const statusItems = { draft: 'Draft', reviewed: 'Reviewed', published: 'Published' }
  const stimulusItems = useMemo(
    () => ({
      [NO_STIMULUS]: '(none)',
      ...Object.fromEntries(
        stimuli.map((stimulus) => [
          stimulus.id,
          `${stimulus.title} (${stimulus.stimulusType.replace(/_/g, ' ')})`,
        ])
      ),
    }),
    [stimuli]
  )

  const isWritingPrompt = values.answerFormat === 'extended_response'

  // Flexible options: labels follow the current count (A, B, C, D[, E]).
  const optionLabels = labelsForCount(values.options.length)
  const correctOptionItems = Object.fromEntries(optionLabels.map((label) => [label, `Option ${label}`]))
  const selectedSubjectName = subjects.find((subject) => subject.id === values.subjectId)?.name ?? null
  const optionRule = getOptionRuleForSubject(selectedSubjectName)
  const minOptionsForSubject = Math.min(...optionRule.allowedCounts)
  const optionCountCheck = checkOptionCount(selectedSubjectName, values.options.length)

  function updateValue<Key extends keyof QuestionFormValues>(key: Key, value: QuestionFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function updateOption(index: number, text: string) {
    setValues((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (optionIndex === index ? text : option)),
    }))
  }

  function addOption() {
    setValues((current) =>
      current.options.length >= MAX_OPTION_COUNT
        ? current
        : { ...current, options: [...current.options, ''] }
    )
  }

  function removeOption(index: number) {
    setValues((current) => {
      if (current.options.length <= minOptionsForSubject) {
        return current
      }
      const nextOptions = current.options.filter((_, optionIndex) => optionIndex !== index)
      const nextLabels = labelsForCount(nextOptions.length)
      return {
        ...current,
        options: nextOptions,
        // Keep the correct answer valid when the removed option shifts labels.
        correctOptionLabel: nextLabels.includes(current.correctOptionLabel)
          ? current.correctOptionLabel
          : 'A',
      }
    })
  }

  function handleSubjectChange(nextSubjectId: string) {
    const nextTopics = topics.filter((topic) => topic.subject_id === nextSubjectId)
    const nextTopicId = nextTopics.some((topic) => topic.id === values.topicId)
      ? values.topicId
      : nextTopics[0]?.id ?? ''
    const nextTypes = questionTypes.filter(
      (questionType) => questionType.topic_id === nextTopicId || questionType.subject_id === nextSubjectId
    )

    setValues((current) => {
      // If no option text has been written yet, snap to the new subject's
      // preferred option count (e.g. 5 for Mathematical Reasoning).
      const nextSubjectName = subjects.find((subject) => subject.id === nextSubjectId)?.name ?? null
      const preferredCount = getOptionRuleForSubject(nextSubjectName).preferredCount
      const allEmpty = current.options.every((option) => !option.trim())
      const nextOptions = allEmpty ? Array.from({ length: preferredCount }, () => '') : current.options

      return {
        ...current,
        subjectId: nextSubjectId,
        topicId: nextTopicId,
        questionTypeId: nextTypes.some((questionType) => questionType.id === current.questionTypeId)
          ? current.questionTypeId
          : '',
        options: nextOptions,
        correctOptionLabel: labelsForCount(nextOptions.length).includes(current.correctOptionLabel)
          ? current.correctOptionLabel
          : 'A',
      }
    })
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
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{mode === 'create' ? 'New question' : 'Edit question'}</Badge>
          <Badge variant="secondary">{ANSWER_FORMAT_LABELS[values.answerFormat]}</Badge>
        </div>
        <div>
          <CardTitle>{mode === 'create' ? 'Create a question' : 'Update question'}</CardTitle>
          <CardDescription>
            {isWritingPrompt
              ? 'Set a clear writing task and a marking rubric so students know exactly what a strong response looks like.'
              : 'Add clear options, a reliable answer key, and enough explanation for students to learn from the result.'}
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
          <input type="hidden" name="answerFormat" value={values.answerFormat} />
          <input type="hidden" name="stimulusId" value={values.stimulusId} />
          {!isWritingPrompt ? (
            <input type="hidden" name="correctOptionLabel" value={values.correctOptionLabel} />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              <Label>Answer format</Label>
              <Select
                value={values.answerFormat}
                onValueChange={(value) =>
                  updateValue('answerFormat', value as QuestionFormValues['answerFormat'])
                }
                items={ANSWER_FORMAT_LABELS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose answer format" />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {ANSWER_FORMAT_LABELS[format]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.answerFormat} />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={values.subjectId} onValueChange={handleSubjectChange} items={subjectItems}>
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
              <Select
                value={values.topicId}
                onValueChange={handleTopicChange}
                disabled={!values.subjectId}
                items={topicItems}
              >
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
                items={questionTypeItems}
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

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
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
              <Label htmlFor="marks">Marks</Label>
              <Input
                id="marks"
                name="marks"
                type="number"
                min="1"
                value={values.marks}
                onChange={(event) => updateValue('marks', event.target.value)}
                placeholder="1"
              />
              <FieldError message={fieldErrors.marks} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeLimitSeconds">Time limit (seconds)</Label>
              <Input
                id="timeLimitSeconds"
                name="timeLimitSeconds"
                type="number"
                min="1"
                value={values.timeLimitSeconds}
                onChange={(event) => updateValue('timeLimitSeconds', event.target.value)}
                placeholder="Optional"
              />
              <FieldError message={fieldErrors.timeLimitSeconds} />
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={values.difficulty}
                onValueChange={(value) => updateValue('difficulty', value)}
                items={difficultyItems}
              >
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
                items={statusItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
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
            <Label>Stimulus</Label>
            <Select
              value={values.stimulusId || NO_STIMULUS}
              onValueChange={(value) => updateValue('stimulusId', value === NO_STIMULUS ? '' : value)}
              items={stimulusItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(stimulusItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Link a shared passage, poem, chart or writing context. Students see the linked stimulus above the
              question.
            </p>
            <FieldError message={fieldErrors.stimulusId} />
          </div>

          {!isWritingPrompt ? (
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
              <p className="text-xs text-muted-foreground">
                For a one-off passage only — prefer a linked stimulus when several questions share it.
              </p>
            </div>
          ) : null}

          {!isWritingPrompt ? (
          <>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Answer options</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {optionRule.label === 'General'
                    ? 'Questions can have four or five options (A–E).'
                    : `${optionRule.label} questions usually have ${optionRule.preferredCount} options.`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={values.options.length >= MAX_OPTION_COUNT}
                onClick={addOption}
              >
                <PlusIcon className="size-3.5" />
                {values.options.length < MAX_OPTION_COUNT
                  ? `Add option ${String.fromCharCode(65 + values.options.length)}`
                  : 'Max options reached'}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {values.options.map((optionText, index) => {
                const label = optionLabels[index]

                return (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`option${label}`}>Option {label}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-muted-foreground"
                        disabled={values.options.length <= minOptionsForSubject}
                        onClick={() => removeOption(index)}
                        aria-label={`Remove option ${label}`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                    <Input
                      id={`option${label}`}
                      name={`option${label}`}
                      value={optionText}
                      onChange={(event) => updateOption(index, event.target.value)}
                    />
                    <FieldError message={fieldErrors[`option${label}`]} />
                  </div>
                )
              })}
            </div>
            {optionCountCheck.warning ? (
              <p className="text-xs font-medium text-amber-700">{optionCountCheck.warning}</p>
            ) : null}
            <FieldError message={optionCountCheck.error ?? fieldErrors.options} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Correct answer</Label>
              <Select
                value={values.correctOptionLabel}
                onValueChange={(value) =>
                  updateValue('correctOptionLabel', value as QuestionFormValues['correctOptionLabel'])
                }
                items={correctOptionItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose the correct option" />
                </SelectTrigger>
                <SelectContent>
                  {optionLabels.map((label) => (
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
          </>
          ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Writing rubric</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Extended response questions have no answer options — they are marked against this rubric instead.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubricJson">Rubric JSON</Label>
              <Textarea
                id="rubricJson"
                name="rubricJson"
                rows={10}
                value={values.rubricJson}
                onChange={(event) => updateValue('rubricJson', event.target.value)}
                placeholder={RUBRIC_PLACEHOLDER}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Optional, but recommended. Must be a JSON object with a &quot;criteria&quot; array — each criterion
                needs a name and a positive maxMarks. textType, scoreBands, planningHints and sampleAnswerNotes are
                also supported.
              </p>
              <FieldError message={fieldErrors.rubricJson} />
            </div>
          </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                value={values.tags}
                onChange={(event) => updateValue('tags', event.target.value)}
                placeholder="Comma separated, e.g. percentages, arithmetic"
              />
              <p className="text-xs text-muted-foreground">Optional labels for filtering and CSV export.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skillTags">Skill tags</Label>
              <Input
                id="skillTags"
                name="skillTags"
                value={values.skillTags}
                onChange={(event) => updateValue('skillTags', event.target.value)}
                placeholder="Comma separated, e.g. inference, main-idea"
              />
              <p className="text-xs text-muted-foreground">Optional skills the question exercises.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conceptTags">Concept tags</Label>
              <Input
                id="conceptTags"
                name="conceptTags"
                value={values.conceptTags}
                onChange={(event) => updateValue('conceptTags', event.target.value)}
                placeholder="Comma separated, e.g. fractions, ratio"
              />
              <p className="text-xs text-muted-foreground">Optional concepts the question covers.</p>
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
