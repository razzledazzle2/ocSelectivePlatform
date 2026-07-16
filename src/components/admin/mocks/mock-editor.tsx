'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  CoffeeIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  duplicateMockTestAction,
  moveMockQuestionAction,
  removeMockQuestionAction,
  setMockTestStatusAction,
  updateMockSectionAction,
  updateMockTestMetaAction,
} from '@/app/admin/mocks/actions'
import { MockCoveragePanel } from '@/components/admin/mocks/mock-coverage-panel'
import { formatDurationMinutes } from '@/components/admin/mocks/mock-list'
import { MockQuestionPicker } from '@/components/admin/mocks/mock-question-picker'
import { QuestionStatusBadge } from '@/components/admin/question-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  MOCK_TYPE_LABELS,
  MOCK_TYPES,
  type MockCoverage,
  type MockTestAttemptStats,
  type MockTestDetail,
  type MockTestQuestionItem,
  type MockTestSectionItem,
  type MockType,
} from '@/lib/mock-tests/types'
import { EXAM_TYPES, type ActionResult, type SubjectRecord, type TopicRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MockEditorProps {
  detail: MockTestDetail
  stats: MockTestAttemptStats
  coverage: MockCoverage
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  tags: string[]
}

/** Full admin editor for one curated mock: builder, coverage, answer key and statistics. */
export function MockEditor({ detail, stats, coverage, subjects, topics, tags }: MockEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // -- Metadata form ------------------------------------------------------------
  const [title, setTitle] = useState(detail.title)
  const [description, setDescription] = useState(detail.description ?? '')
  const [examType, setExamType] = useState<string>(detail.examType)
  const [yearLevel, setYearLevel] = useState(detail.yearLevel ? String(detail.yearLevel) : '')
  const [mockType, setMockType] = useState<string>(detail.mockType)
  const [difficultyLabel, setDifficultyLabel] = useState(detail.difficultyLabel ?? '')
  const [instructions, setInstructions] = useState(detail.instructions ?? '')

  const metaDirty =
    title !== detail.title ||
    description !== (detail.description ?? '') ||
    examType !== detail.examType ||
    yearLevel !== (detail.yearLevel ? String(detail.yearLevel) : '') ||
    mockType !== detail.mockType ||
    difficultyLabel !== (detail.difficultyLabel ?? '') ||
    instructions !== (detail.instructions ?? '')

  // -- Dialog state ---------------------------------------------------------------
  const [pickerSection, setPickerSection] = useState<MockTestSectionItem | null>(null)
  const [sectionEdit, setSectionEdit] = useState<MockTestSectionItem | null>(null)
  const [sectionName, setSectionName] = useState('')
  const [sectionMinutes, setSectionMinutes] = useState('')
  const [sectionBreakMinutes, setSectionBreakMinutes] = useState('')
  const [removeTarget, setRemoveTarget] = useState<MockTestQuestionItem | null>(null)

  const allQuestions = useMemo(() => detail.sections.flatMap((section) => section.questions), [detail.sections])
  const existingQuestionIds = useMemo(() => new Set(allQuestions.map((question) => question.questionId)), [allQuestions])
  const questionCount = allQuestions.length
  const draftCount = allQuestions.filter((question) => question.questionStatus !== 'published').length
  const totalDurationSeconds = detail.sections.reduce(
    (sum, section) => sum + section.timeLimitSeconds + section.breakAfterSeconds,
    0
  )

  const examItems = Object.fromEntries(EXAM_TYPES.map((value) => [value, value]))
  const mockTypeItems = Object.fromEntries(MOCK_TYPES.map((value) => [value, MOCK_TYPE_LABELS[value]]))

  function run(action: () => Promise<ActionResult<{ redirectTo: string } | undefined>>) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        if (result.message) {
          toast.success(result.message)
        }
        const redirectTo =
          result.data && 'redirectTo' in (result.data as object)
            ? (result.data as { redirectTo: string }).redirectTo
            : null
        if (redirectTo) {
          router.push(redirectTo)
        }
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  function saveMeta() {
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('examType', examType)
    formData.set('yearLevel', yearLevel)
    formData.set('mockType', mockType)
    formData.set('difficultyLabel', difficultyLabel)
    formData.set('instructions', instructions)
    run(() => updateMockTestMetaAction(detail.id, formData))
  }

  function openSectionEdit(section: MockTestSectionItem) {
    setSectionEdit(section)
    setSectionName(section.name)
    setSectionMinutes(String(Math.round(section.timeLimitSeconds / 60)))
    setSectionBreakMinutes(String(Math.round(section.breakAfterSeconds / 60)))
  }

  function saveSection() {
    if (!sectionEdit) {
      return
    }
    run(() =>
      updateMockSectionAction(detail.id, sectionEdit.id, {
        name: sectionName,
        timeLimitSeconds: Math.round(Number(sectionMinutes) * 60),
        breakAfterSeconds: Math.round(Number(sectionBreakMinutes) * 60),
      })
    )
    setSectionEdit(null)
  }

  return (
    <div className="space-y-6">
      {/* -- Header strip: status + lifecycle actions -------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <QuestionStatusBadge status={detail.status} />
          <Badge variant="outline">{detail.examType}</Badge>
          {detail.yearLevel ? <Badge variant="outline">Year {detail.yearLevel}</Badge> : null}
          <span className="text-sm text-muted-foreground">
            {detail.sections.length} sections · {questionCount} questions ·{' '}
            {formatDurationMinutes(totalDurationSeconds)} incl. breaks
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(() => duplicateMockTestAction(detail.id))}>
            <CopyIcon className="size-3.5" />
            Duplicate
          </Button>
          {detail.status === 'published' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setMockTestStatusAction(detail.id, 'draft'))}
            >
              <RotateCcwIcon className="size-3.5" />
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isPending || questionCount === 0}
              onClick={() => run(() => setMockTestStatusAction(detail.id, 'published'))}
            >
              <RocketIcon className="size-3.5" />
              Publish
            </Button>
          )}
          {detail.status !== 'archived' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setMockTestStatusAction(detail.id, 'archived'))}
            >
              <ArchiveIcon className="size-3.5" />
              Archive
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setMockTestStatusAction(detail.id, 'draft'))}
            >
              <RotateCcwIcon className="size-3.5" />
              Restore to draft
            </Button>
          )}
        </div>
      </div>

      {draftCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-foreground">
            {draftCount} question{draftCount === 1 ? ' is' : 's are'} not published yet. Students only
            ever see published questions — publish them in the Question Bank before publishing this mock.
          </p>
        </div>
      ) : null}

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="answers">Answer key</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* ================= Builder ================= */}
        <TabsContent value="builder" className="space-y-6 pt-5">
          {/* Metadata */}
          <Card className="rounded-2xl border border-border shadow-card">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Exam type</Label>
                  <Select value={examType} onValueChange={setExamType} items={examItems}>
                    <SelectTrigger className="w-full" aria-label="Exam type">
                      <SelectValue />
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
                <div className="space-y-1.5">
                  <Label htmlFor="edit-year">Year level (optional)</Label>
                  <Input
                    id="edit-year"
                    value={yearLevel}
                    onChange={(event) => setYearLevel(event.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 6"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mock type</Label>
                  <Select value={mockType} onValueChange={setMockType} items={mockTypeItems}>
                    <SelectTrigger className="w-full" aria-label="Mock type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {MOCK_TYPE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-difficulty-label">Difficulty label (optional)</Label>
                  <Input
                    id="edit-difficulty-label"
                    value={difficultyLabel}
                    onChange={(event) => setDifficultyLabel(event.target.value)}
                    placeholder="e.g. Exam standard"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-instructions">Instructions for students (optional)</Label>
                  <Textarea
                    id="edit-instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={3}
                    placeholder="Shown before the student begins. Leave blank to use the standard exam instructions."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={isPending || !metaDirty || !title.trim()} onClick={saveMeta}>
                  Save details
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          {detail.sections.map((section, index) => (
            <div key={section.id} className="space-y-3">
              <Card className="rounded-2xl border border-border shadow-card">
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand">
                          {index + 1}
                        </span>
                        {section.name}
                      </CardTitle>
                      <CardDescription>
                        {section.subjectName ?? 'No linked subject'} ·{' '}
                        {formatDurationMinutes(section.timeLimitSeconds)} ·{' '}
                        {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => openSectionEdit(section)}
                      >
                        <PencilIcon className="size-3.5" />
                        Edit section
                      </Button>
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setPickerSection(section)}>
                        <PlusIcon className="size-3.5" />
                        Add questions
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={section.questions.length === 0 ? 'pt-4' : 'p-2'}>
                  {section.questions.length === 0 ? (
                    section.sectionKey === 'writing' ? (
                      <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                        Writing is a free-response section — students type their answer against the
                        timer. No multiple-choice questions are needed here.
                      </p>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                        No questions in this section yet. Use “Add questions” to pick them from the bank.
                      </p>
                    )
                  ) : (
                    <ol className="space-y-1">
                      {section.questions.map((question, questionIndex) => (
                        <li
                          key={question.id}
                          className="group flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50"
                        >
                          <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                            {questionIndex + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm text-foreground">{question.questionText}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span>{question.topicName}</span>
                              <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
                                D{question.difficulty}
                              </Badge>
                              <span>
                                Ans{' '}
                                <span className="font-semibold text-foreground/80">
                                  {question.correctOptionLabel ?? '—'}
                                </span>
                              </span>
                              {question.questionStatus !== 'published' ? (
                                <QuestionStatusBadge status={question.questionStatus} />
                              ) : null}
                              {question.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="h-4 px-1.5 text-[0.65rem]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={isPending || questionIndex === 0}
                              onClick={() => run(() => moveMockQuestionAction(detail.id, question.id, 'up'))}
                              aria-label="Move up"
                            >
                              <ArrowUpIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={isPending || questionIndex === section.questions.length - 1}
                              onClick={() => run(() => moveMockQuestionAction(detail.id, question.id, 'down'))}
                              aria-label="Move down"
                            >
                              <ArrowDownIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              disabled={isPending}
                              onClick={() => setRemoveTarget(question)}
                              aria-label="Remove from mock"
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>

              {section.breakAfterSeconds > 0 ? (
                <div className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
                  <CoffeeIcon className="size-3.5" />
                  Break: {formatDurationMinutes(section.breakAfterSeconds)}, skippable
                </div>
              ) : null}
            </div>
          ))}
        </TabsContent>

        {/* ================= Coverage ================= */}
        <TabsContent value="coverage" className="pt-5">
          {questionCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Add questions in the Builder tab to see coverage.
            </p>
          ) : (
            <MockCoveragePanel coverage={coverage} />
          )}
        </TabsContent>

        {/* ================= Answer key ================= */}
        <TabsContent value="answers" className="space-y-6 pt-5">
          {detail.sections
            .filter((section) => section.questions.length > 0)
            .map((section) => (
              <Card key={section.id} className="rounded-2xl border border-border shadow-card">
                <CardHeader className="border-b border-border/70">
                  <CardTitle>{section.name} — answer key</CardTitle>
                  <CardDescription>
                    {section.questions.length} question{section.questions.length === 1 ? '' : 's'} with
                    correct answers and worked solutions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/70 pt-2">
                  {section.questions.map((question, index) => (
                    <div key={question.id} className="space-y-2.5 py-4 first:pt-2 last:pb-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          {question.passageText ? (
                            <details className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                              <summary className="cursor-pointer text-xs font-medium text-foreground">
                                Passage
                              </summary>
                              <p className="mt-1.5 whitespace-pre-wrap">{question.passageText}</p>
                            </details>
                          ) : null}
                          <p className="whitespace-pre-wrap text-sm text-foreground">{question.questionText}</p>
                          <ul className="space-y-1">
                            {question.options.map((option) => {
                              const isCorrect = option.label === question.correctOptionLabel
                              return (
                                <li
                                  key={option.label}
                                  className={cn(
                                    'flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm',
                                    isCorrect
                                      ? 'border-success/40 bg-success-soft font-medium text-foreground'
                                      : 'border-border/60 text-muted-foreground'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-semibold',
                                      isCorrect ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {option.label}
                                  </span>
                                  <span className="whitespace-pre-wrap">{option.option_text}</span>
                                </li>
                              )
                            })}
                          </ul>
                          {question.workedSolution || question.shortExplanation ? (
                            <details className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                              <summary className="cursor-pointer text-xs font-medium text-foreground">
                                Solution
                              </summary>
                              <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">
                                {question.workedSolution || question.shortExplanation}
                              </p>
                            </details>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{question.topicName}</span>
                            {question.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="h-4 px-1.5 text-[0.65rem]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          {questionCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Add questions in the Builder tab to see the answer key here.
            </p>
          ) : null}
        </TabsContent>

        {/* ================= Statistics ================= */}
        <TabsContent value="stats" className="space-y-6 pt-5">
          {stats.attemptsCount === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <BarChart3Icon className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">No attempts yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Statistics appear once students complete this mock. Publish it so it can be attempted.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attempts</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.attemptsCount}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average score</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {stats.averageAccuracy !== null ? `${stats.averageAccuracy}%` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average time</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {stats.averageTimeSeconds !== null ? formatDurationMinutes(stats.averageTimeSeconds) : '—'}
                  </p>
                </div>
              </div>

              {detail.sections
                .filter((section) => section.questions.length > 0)
                .map((section) => (
                  <Card key={section.id} className="rounded-2xl border border-border shadow-card">
                    <CardHeader className="border-b border-border/70">
                      <CardTitle>{section.name} — question performance</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="overflow-x-auto rounded-lg border border-border/70">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Question</TableHead>
                              <TableHead className="text-right">Answered</TableHead>
                              <TableHead className="text-right">Correct %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.questions.map((question, index) => {
                              const entry = stats.perQuestion[question.questionId]
                              return (
                                <TableRow key={question.id}>
                                  <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                                  <TableCell className="max-w-96">
                                    <span className="line-clamp-1 text-sm">{question.questionText}</span>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {entry?.attempts ?? 0}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {entry && entry.attempts > 0 ? (
                                      `${Math.round((entry.correct / entry.attempts) * 100)}%`
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* -- Add questions picker ------------------------------------------------ */}
      <MockQuestionPicker
        mockTestId={detail.id}
        section={
          pickerSection
            ? { id: pickerSection.id, name: pickerSection.name, subjectId: pickerSection.subjectId }
            : null
        }
        existingQuestionIds={existingQuestionIds}
        subjects={subjects}
        topics={topics}
        tags={tags}
        onClose={() => setPickerSection(null)}
        onAdded={() => router.refresh()}
      />

      {/* -- Edit section dialog -------------------------------------------------- */}
      <Dialog open={sectionEdit !== null} onOpenChange={(open) => !open && setSectionEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
            <DialogDescription>Name, time limit and the break after this section.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="section-name">Name</Label>
              <Input id="section-name" value={sectionName} onChange={(event) => setSectionName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="section-minutes">Time limit (minutes)</Label>
                <Input
                  id="section-minutes"
                  value={sectionMinutes}
                  onChange={(event) => setSectionMinutes(event.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="section-break">Break after (minutes)</Label>
                <Input
                  id="section-break"
                  value={sectionBreakMinutes}
                  onChange={(event) => setSectionBreakMinutes(event.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                isPending ||
                !sectionName.trim() ||
                !Number(sectionMinutes) ||
                Number(sectionMinutes) <= 0 ||
                Number(sectionBreakMinutes) < 0 ||
                Number.isNaN(Number(sectionBreakMinutes))
              }
              onClick={saveSection}
            >
              Save section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Remove question confirmation ------------------------------------------ */}
      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this question?</DialogTitle>
            <DialogDescription>
              It only leaves this mock — the question stays in the bank unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (removeTarget) {
                  run(() => removeMockQuestionAction(detail.id, removeTarget.id))
                }
                setRemoveTarget(null)
              }}
            >
              <Trash2Icon className="size-4" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

