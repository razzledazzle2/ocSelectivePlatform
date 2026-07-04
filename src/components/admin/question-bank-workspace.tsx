'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ArchiveIcon,
  DownloadIcon,
  RocketIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveQuestionAction,
  createSimilarQuestionAction,
  duplicateQuestionAction,
  getQuestionPreviewAction,
  publishQuestionAction,
  unpublishQuestionAction,
} from '@/app/admin/questions/actions'
import { QuestionListRow } from '@/components/admin/question-list-row'
import { QuestionPreviewPane } from '@/components/admin/question-preview-pane'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { exportQuestionsCsv } from '@/lib/questions/export-csv'
import type { QuestionStatusCounts } from '@/lib/questions/queries'
import {
  ADMIN_QUESTION_SORT_LABELS,
  DEFAULT_ADMIN_QUESTION_PAGE_SIZE,
  EXAM_TYPES,
  QUESTION_STATUSES,
  type ActionResult,
  type AdminQuestionFilters,
  type AdminQuestionListItem,
  type AdminQuestionsPage,
  type QuestionDetail,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

const ALL = 'all'
const difficultyValues = ['1', '2', '3', '4', '5'] as const

interface QuestionBankWorkspaceProps {
  data: AdminQuestionsPage
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  /** Distinct tags across the bank, for the tag filter. */
  tags: string[]
  filters: AdminQuestionFilters
  statusCounts: QuestionStatusCounts
}

/**
 * Hybrid question bank: a scannable, filterable, PAGINATED list on the left
 * and a sticky student-style preview of the selected question on the right.
 * All filters, the sort and the page live in the URL so pagination preserves
 * them and filter changes reset to page 1.
 */
export function QuestionBankWorkspace({
  data,
  subjects,
  topics,
  questionTypes,
  tags,
  filters,
  statusCounts,
}: QuestionBankWorkspaceProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isNavigating, startNavigation] = useTransition()

  const questions = data.items

  // -- URL-driven filters (server filtering preserved) -----------------------
  const [query, setQuery] = useState(filters.query ?? '')
  const examType = filters.examType ?? ALL
  const subjectId = filters.subjectId ?? ALL
  const topicId = filters.topicId ?? ALL
  const questionTypeId = filters.questionTypeId ?? ALL
  const tag = filters.tag ?? ALL
  const difficulty = filters.difficulty ?? ALL
  const status = filters.status ?? ALL
  const sort = filters.sort && filters.sort in ADMIN_QUESTION_SORT_LABELS ? filters.sort : 'updated_desc'

  const filteredTopics = useMemo(
    () => (subjectId === ALL ? topics : topics.filter((topic) => topic.subject_id === subjectId)),
    [topics, subjectId]
  )
  const filteredQuestionTypes = useMemo(
    () =>
      subjectId === ALL
        ? questionTypes
        : questionTypes.filter((type) => type.subject_id === subjectId),
    [questionTypes, subjectId]
  )

  // base-ui Select needs value->label maps so triggers show names, not raw ids/values.
  const examItems = { [ALL]: 'All exam types', ...Object.fromEntries(EXAM_TYPES.map((v) => [v, v])) }
  const statusItems = {
    [ALL]: 'All statuses',
    ...Object.fromEntries(QUESTION_STATUSES.map((v) => [v, v[0].toUpperCase() + v.slice(1)])),
  }
  const difficultyItems = {
    [ALL]: 'All difficulties',
    ...Object.fromEntries(difficultyValues.map((v) => [v, `Difficulty ${v}`])),
  }
  const subjectItems = useMemo(
    () => ({ [ALL]: 'All subjects', ...Object.fromEntries(subjects.map((s) => [s.id, s.name])) }),
    [subjects]
  )
  const topicItems = useMemo(
    () => ({ [ALL]: 'All topics', ...Object.fromEntries(filteredTopics.map((t) => [t.id, t.name])) }),
    [filteredTopics]
  )
  const questionTypeItems = useMemo(
    () => ({
      [ALL]: 'All question types',
      ...Object.fromEntries(filteredQuestionTypes.map((t) => [t.id, t.name])),
    }),
    [filteredQuestionTypes]
  )
  const tagItems = useMemo(
    () => ({ [ALL]: 'All tags', ...Object.fromEntries(tags.map((t) => [t, t])) }),
    [tags]
  )

  function navigate(params: URLSearchParams) {
    const queryString = params.toString()
    startNavigation(() => {
      router.push(queryString ? `/admin/questions?${queryString}` : '/admin/questions')
    })
  }

  /** Merge filter changes into the URL. Any filter/sort change resets to page 1. */
  function pushFilters(next: Partial<Record<keyof AdminQuestionFilters, string>>) {
    const merged: Record<string, string> = {
      query: query.trim(),
      examType,
      subjectId,
      topicId,
      questionTypeId,
      tag,
      difficulty,
      status,
      sort,
      pageSize: filters.pageSize ?? '',
      ...next,
    }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (!value || value === ALL) continue
      if (key === 'sort' && value === 'updated_desc') continue
      if (key === 'pageSize' && Number(value) === DEFAULT_ADMIN_QUESTION_PAGE_SIZE) continue
      params.set(key, value)
    }
    navigate(params)
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(window.location.search)
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    navigate(params)
  }

  function resetFilters() {
    setQuery('')
    navigate(new URLSearchParams())
  }

  const hasActiveFilters =
    Boolean(filters.query) ||
    [examType, subjectId, topicId, questionTypeId, tag, difficulty, status].some((value) => value !== ALL)

  // -- Selection (preview) + bulk checkboxes ----------------------------------
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (questions.length === 0) {
      setPreviewId(null)
      return
    }
    if (!previewId || !questions.some((question) => question.id === previewId)) {
      setPreviewId(questions[0].id)
    }
  }, [questions, previewId])

  const previewItem = questions.find((question) => question.id === previewId) ?? null
  const checkedQuestions = questions.filter((question) => checkedIds.has(question.id))
  const allChecked = questions.length > 0 && checkedQuestions.length === questions.length

  function toggleAllChecked() {
    setCheckedIds(allChecked ? new Set() : new Set(questions.map((question) => question.id)))
  }

  function setChecked(id: string, checked: boolean) {
    setCheckedIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  function selectQuestion(id: string) {
    setPreviewId(id)
    // Below lg the preview pane is hidden, so open it as a drawer instead.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSheetOpen(true)
    }
  }

  // -- Preview detail loading (cached per id) ----------------------------------
  const [details, setDetails] = useState<Record<string, QuestionDetail>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  async function loadDetail(id: string, options?: { force?: boolean }) {
    if (!options?.force && details[id]) {
      return
    }
    const requestId = ++requestSeq.current
    setPreviewLoading(true)
    setPreviewError(null)
    const result = await getQuestionPreviewAction(id)
    if (requestId !== requestSeq.current) {
      return
    }
    setPreviewLoading(false)
    if (result.success && result.data) {
      const data = result.data
      setDetails((current) => ({ ...current, [id]: data }))
    } else {
      setPreviewError(result.message ?? 'Unable to load the question preview.')
    }
  }

  useEffect(() => {
    if (previewId) {
      void loadDetail(previewId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId])

  // -- Mutations ---------------------------------------------------------------
  function runStatusAction(ids: string[], action: (id: string) => Promise<ActionResult>, label: string) {
    startTransition(async () => {
      let succeeded = 0
      let failed = 0
      for (const id of ids) {
        const result = await action(id)
        if (result.success) {
          succeeded += 1
        } else {
          failed += 1
        }
      }
      if (failed === 0) {
        toast.success(ids.length === 1 ? `${label}.` : `${label} for ${succeeded} questions.`)
      } else {
        toast.error(`${succeeded} succeeded, ${failed} failed.`)
      }
      setCheckedIds(new Set())
      router.refresh()
      if (previewId && ids.includes(previewId)) {
        void loadDetail(previewId, { force: true })
      }
    })
  }

  function runRedirectAction(action: () => Promise<ActionResult<{ redirectTo: string }>>) {
    startTransition(async () => {
      const result = await action()
      if (result.success && result.data?.redirectTo) {
        toast.success(result.message ?? 'Draft created.')
        router.push(result.data.redirectTo)
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  // -- Archive confirmation ------------------------------------------------------
  const [archiveIds, setArchiveIds] = useState<string[] | null>(null)

  function confirmArchive() {
    if (archiveIds && archiveIds.length > 0) {
      runStatusAction(archiveIds, archiveQuestionAction, 'Question archived')
    }
    setArchiveIds(null)
  }

  function publishToggle(question: AdminQuestionListItem) {
    if (question.status === 'published') {
      runStatusAction([question.id], unpublishQuestionAction, 'Question moved back to draft')
    } else {
      runStatusAction([question.id], publishQuestionAction, 'Question published')
    }
  }

  // -- Render --------------------------------------------------------------------
  const previewPane = (
    <QuestionPreviewPane
      item={previewItem}
      detail={previewItem ? details[previewItem.id] ?? null : null}
      isLoading={previewLoading}
      error={previewError}
      isBusy={isPending}
      onPublishToggle={() => previewItem && publishToggle(previewItem)}
      onDuplicate={() => previewItem && runRedirectAction(() => duplicateQuestionAction(previewItem.id))}
      onCreateSimilar={() =>
        previewItem && runRedirectAction(() => createSimilarQuestionAction(previewItem.id))
      }
      onArchive={() => previewItem && setArchiveIds([previewItem.id])}
    />
  )

  return (
    <div className="items-start gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      {/* -- Left: toolbar + list ------------------------------------------- */}
      <div className="min-w-0 space-y-4">
        {/* Search + filters */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              pushFilters({ query: query.trim() })
            }}
          >
            <div className="relative min-w-[14rem] flex-1">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search questions…"
                className="pl-8"
                aria-label="Search questions"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <XIcon className="size-3.5" />
                Reset
              </Button>
            ) : null}
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={examType} onValueChange={(value) => pushFilters({ examType: value })} items={examItems}>
              <SelectTrigger className="w-full" aria-label="Exam type">
                <SelectValue placeholder="All exam types" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(examItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={subjectId}
              onValueChange={(value) => pushFilters({ subjectId: value, topicId: ALL, questionTypeId: ALL })}
              items={subjectItems}
            >
              <SelectTrigger className="w-full" aria-label="Subject">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(subjectItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={topicId} onValueChange={(value) => pushFilters({ topicId: value })} items={topicItems}>
              <SelectTrigger className="w-full" aria-label="Topic">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(topicItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={questionTypeId}
              onValueChange={(value) => pushFilters({ questionTypeId: value })}
              items={questionTypeItems}
            >
              <SelectTrigger className="w-full" aria-label="Question type">
                <SelectValue placeholder="All question types" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(questionTypeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tag} onValueChange={(value) => pushFilters({ tag: value })} items={tagItems}>
              <SelectTrigger className="w-full" aria-label="Tag">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tagItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={difficulty}
              onValueChange={(value) => pushFilters({ difficulty: value })}
              items={difficultyItems}
            >
              <SelectTrigger className="w-full" aria-label="Difficulty">
                <SelectValue placeholder="All difficulties" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(difficultyItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(value) => pushFilters({ status: value })} items={statusItems}>
              <SelectTrigger className="w-full" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => pushFilters({ sort: value })} items={ADMIN_QUESTION_SORT_LABELS}>
              <SelectTrigger className="w-full" aria-label="Sort order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ADMIN_QUESTION_SORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk action bar */}
        {checkedQuestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5">
            <p className="text-sm font-medium text-foreground">
              {checkedQuestions.length} selected
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  runStatusAction(
                    checkedQuestions.filter((q) => q.status !== 'published').map((q) => q.id),
                    publishQuestionAction,
                    'Published'
                  )
                }
              >
                <RocketIcon className="size-3.5" />
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  runStatusAction(
                    checkedQuestions.filter((q) => q.status === 'published').map((q) => q.id),
                    unpublishQuestionAction,
                    'Unpublished'
                  )
                }
              >
                <RotateCcwIcon className="size-3.5" />
                Unpublish
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setArchiveIds(checkedQuestions.map((q) => q.id))}
              >
                <ArchiveIcon className="size-3.5" />
                Archive
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportQuestionsCsv(checkedQuestions)}>
                <DownloadIcon className="size-3.5" />
                Export selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {/* List */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Select all questions on this page"
                className="size-4 accent-primary"
                checked={allChecked}
                onChange={toggleAllChecked}
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.totalCount}</span> question
                {data.totalCount === 1 ? '' : 's'}
                {hasActiveFilters ? ' match' : ''}
                <span className="hidden sm:inline">
                  {' '}
                  · {statusCounts.published} published · {statusCounts.draft} draft ·{' '}
                  {statusCounts.archived} archived
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => exportQuestionsCsv(questions)}
            >
              <DownloadIcon className="size-3.5" />
              Export page
            </Button>
          </div>

          {questions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No questions found</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No questions match the current filters. Adjust or reset the filters above.'
                  : 'The bank is empty. Add a question manually or import a CSV to get started.'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div
              className={
                isNavigating ? 'space-y-1 p-2 opacity-50 transition-opacity' : 'space-y-1 p-2 transition-opacity'
              }
            >
              {questions.map((question) => (
                <QuestionListRow
                  key={question.id}
                  question={question}
                  isActive={question.id === previewId}
                  isChecked={checkedIds.has(question.id)}
                  isBusy={isPending}
                  onSelect={() => selectQuestion(question.id)}
                  onCheckedChange={(checked) => setChecked(question.id, checked)}
                  onPublishToggle={() => publishToggle(question)}
                  onDuplicate={() => runRedirectAction(() => duplicateQuestionAction(question.id))}
                  onCreateSimilar={() =>
                    runRedirectAction(() => createSimilarQuestionAction(question.id))
                  }
                  onArchive={() => setArchiveIds([question.id])}
                />
              ))}
            </div>
          )}

          {/* Pagination footer */}
          <div className="border-t border-border px-4 py-3">
            <PaginationControls
              page={data.page}
              pageCount={data.pageCount}
              totalCount={data.totalCount}
              pageSize={data.pageSize}
              itemLabel="question"
              disabled={isNavigating}
              onPageChange={goToPage}
              onPageSizeChange={(size) => pushFilters({ pageSize: String(size) })}
            />
          </div>
        </div>
      </div>

      {/* -- Right: sticky preview (desktop) --------------------------------- */}
      <div className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto lg:block">
        {previewPane}
      </div>

      {/* -- Mobile/tablet: preview drawer ------------------------------------ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-lg lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Question preview</SheetTitle>
          </SheetHeader>
          {previewPane}
        </SheetContent>
      </Sheet>

      {/* -- Archive confirmation --------------------------------------------- */}
      <AlertDialog open={archiveIds !== null} onOpenChange={(open) => !open && setArchiveIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {archiveIds && archiveIds.length > 1 ? `${archiveIds.length} questions` : 'this question'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived questions are hidden from student practice, but stay in the bank for later
              editing or restoration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
