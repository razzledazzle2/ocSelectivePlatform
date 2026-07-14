'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ArchiveIcon,
  DownloadIcon,
  RocketIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createSimilarQuestionAction,
  duplicateQuestionAction,
  getQuestionPreviewAction,
  publishQuestionAction,
  restoreQuestionAction,
  unpublishQuestionAction,
} from '@/app/admin/questions/actions'
import {
  bulkArchiveQuestionsAction,
  bulkPublishQuestionsAction,
  bulkRestoreQuestionsAction,
  bulkTrashQuestionsAction,
  bulkUnpublishQuestionsAction,
} from '@/app/admin/questions/bulk-actions'
import { exportQuestionsCsvAction } from '@/app/admin/questions/export-actions'
import { BulkDeleteQuestionsDialog } from '@/components/admin/bulk-delete-questions-dialog'
import { GenerateMissingAssetsButton } from '@/components/admin/generate-missing-assets-button'
import { QuestionListRow } from '@/components/admin/question-list-row'
import { QuestionPreviewPane } from '@/components/admin/question-preview-pane'
import { SelectAllMatchingBanner } from '@/components/admin/select-all-matching-banner'
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
import { useQuestionSelection } from '@/hooks/use-question-selection'
import type { QuestionStatusCounts } from '@/lib/questions/queries'
import {
  ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT,
  ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE,
  ADMIN_QUESTION_SORT_LABELS,
  DEFAULT_ADMIN_QUESTION_PAGE_SIZE,
  EXAM_TYPES,
  QUESTION_STATUSES,
  type ActionResult,
  type AdminQuestionFilters,
  type AdminQuestionListItem,
  type AdminQuestionsPage,
  type BulkQuestionMutationResult,
  type BulkQuestionSelectionInput,
  type BulkSelectionPreview,
  type QuestionDetail,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'
import {
  QUESTION_FAMILIES,
  STIMULUS_FORMATS,
  getAllDomains,
  getAllSkills,
  getAllSubtopics,
  getDomainsForSubject,
  getSubtopicsForDomain,
  getSuggestedSkillsForSubtopic,
  resolveLegacySubject,
} from '@/lib/taxonomy'

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

function describeSelection(input: BulkQuestionSelectionInput, selectedCount: number): string {
  if (input.mode === 'explicit') {
    return `${selectedCount} selected question${selectedCount === 1 ? '' : 's'}`
  }
  return `${selectedCount} question${selectedCount === 1 ? '' : 's'} matching the current filters`
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
  const [isBulkPending, startBulkTransition] = useTransition()
  const [isNavigating, startNavigation] = useTransition()
  const [isExporting, startExport] = useTransition()

  const runExport = (selection?: BulkQuestionSelectionInput) => {
    startExport(async () => {
      const result = await exportQuestionsCsvAction(filters, selection)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to export questions.')
        return
      }
      const { csv, filename } = result.data
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(result.message ?? 'Export ready.')
    })
  }

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
  const assetState = filters.assetState ?? ALL
  const domainCode = filters.domainCode ?? ALL
  const subtopicCode = filters.subtopicCode ?? ALL
  const skillCode = filters.skillCode ?? ALL
  const questionFamily = filters.questionFamily ?? ALL
  const stimulusFormat = filters.stimulusFormat ?? ALL
  const sort = filters.sort && filters.sort in ADMIN_QUESTION_SORT_LABELS ? filters.sort : 'updated_desc'

  const [patternKeyInput, setPatternKeyInput] = useState(filters.patternKey ?? '')
  useEffect(() => setPatternKeyInput(filters.patternKey ?? ''), [filters.patternKey])

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

  // -- Canonical taxonomy filters (subject → domain → subtopic → skill) -------
  const subjectCode = useMemo(
    () => (subjectId === ALL ? null : resolveLegacySubject(subjects.find((s) => s.id === subjectId)?.slug ?? null)),
    [subjects, subjectId]
  )
  const domainOptions = useMemo(
    () => (subjectCode ? getDomainsForSubject(subjectCode) : getAllDomains()),
    [subjectCode]
  )
  const subtopicOptions = useMemo(
    () => (domainCode === ALL ? getAllSubtopics() : getSubtopicsForDomain(domainCode)),
    [domainCode]
  )
  const skillOptions = useMemo(
    () => (subtopicCode === ALL ? getAllSkills() : getSuggestedSkillsForSubtopic(subtopicCode)),
    [subtopicCode]
  )

  const domainItems = useMemo(
    () => ({ [ALL]: 'All domains', ...Object.fromEntries(domainOptions.map((d) => [d.code, d.label])) }),
    [domainOptions]
  )
  const subtopicItems = useMemo(
    () => ({ [ALL]: 'All subtopics', ...Object.fromEntries(subtopicOptions.map((s) => [s.code, s.label])) }),
    [subtopicOptions]
  )
  const skillItems = useMemo(
    () => ({ [ALL]: 'All skills', ...Object.fromEntries(skillOptions.map((s) => [s.code, s.label])) }),
    [skillOptions]
  )
  const questionFamilyItems = {
    [ALL]: 'All families',
    ...Object.fromEntries(QUESTION_FAMILIES.map((item) => [item.code, item.label])),
  }
  const stimulusFormatItems = {
    [ALL]: 'All stimulus types',
    ...Object.fromEntries(STIMULUS_FORMATS.map((item) => [item.code, item.label])),
  }

  // base-ui Select needs value->label maps so triggers show names, not raw ids/values.
  const examItems = { [ALL]: 'All exam types', ...Object.fromEntries(EXAM_TYPES.map((v) => [v, v])) }
  const statusItems = {
    [ALL]: 'All statuses',
    ...Object.fromEntries(QUESTION_STATUSES.map((v) => [v, v[0].toUpperCase() + v.slice(1)])),
    // Synthetic "trash" view — soft-deleted questions (tracked by deleted_at,
    // not a real status). Selecting it shows ONLY trashed questions.
    deleted: 'Deleted (Trash)',
  }
  const assetItems = {
    [ALL]: 'All assets',
    has: 'Has asset',
    pending: 'Pending asset',
    missing: 'Missing asset',
    approved: 'Asset approved',
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
      domainCode,
      subtopicCode,
      skillCode,
      questionFamily,
      stimulusFormat,
      patternKey: patternKeyInput.trim(),
      tag,
      difficulty,
      status,
      assetState,
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
    Boolean(filters.patternKey) ||
    [
      examType,
      subjectId,
      topicId,
      questionTypeId,
      domainCode,
      subtopicCode,
      skillCode,
      questionFamily,
      stimulusFormat,
      tag,
      difficulty,
      status,
      assetState,
    ].some((value) => value !== ALL)

  // -- Preview (single-row focus) -----------------------------------------------
  const [previewId, setPreviewId] = useState<string | null>(null)
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

  // -- Bulk selection (explicit across pages, or all-matching-filters) --------
  const visibleIds = useMemo(() => questions.map((question) => question.id), [questions])
  const filterKey = useMemo(
    () =>
      JSON.stringify([
        query.trim(),
        examType,
        subjectId,
        topicId,
        questionTypeId,
        domainCode,
        subtopicCode,
        skillCode,
        questionFamily,
        stimulusFormat,
        patternKeyInput.trim(),
        tag,
        difficulty,
        status,
        assetState,
      ]),
    // query/patternKeyInput are the committed-on-submit values (filters.query / filters.patternKey)
    // everywhere else in this component, so key off those rather than every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.query,
      examType,
      subjectId,
      topicId,
      questionTypeId,
      domainCode,
      subtopicCode,
      skillCode,
      questionFamily,
      stimulusFormat,
      filters.patternKey,
      tag,
      difficulty,
      status,
      assetState,
    ]
  )
  const selection = useQuestionSelection({ visibleIds, filterKey, sortKey: sort })
  const checkedQuestions = questions.filter((question) => selection.isSelected(question.id))
  // True only when every explicitly-selected id is accounted for by rows we actually
  // have loaded (the common "picked some rows on this page" case) — lets the bulk bar
  // show precise, composition-aware actions. Cross-page or all-matching selections fall
  // back to always offering every action and letting the server report what applied.
  const hasFullCompositionKnowledge =
    selection.state.mode === 'explicit' && checkedQuestions.length === selection.selectedCount

  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selection.headerState === 'indeterminate'
    }
  }, [selection.headerState])

  const [liveMessage, setLiveMessage] = useState('')
  useEffect(() => {
    if (selection.selectedCount > 0) {
      setLiveMessage(`${selection.selectedCount} question${selection.selectedCount === 1 ? '' : 's'} selected.`)
    }
  }, [selection.selectedCount])

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

  // -- Single-row mutations (row menu / preview pane; immediate, no confirmation) --
  function runStatusAction(ids: string[], action: (id: string) => Promise<ActionResult>, label: string) {
    startTransition(async () => {
      const result = await action(ids[0])
      if (result.success) {
        toast.success(`${label}.`)
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
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

  // -- Bulk mutations: one request, one permission check, one set-based update per
  // chunk, one revalidation, one refresh — see bulk-mutations.ts / bulk-actions.ts.
  function runBulkAction(
    input: BulkQuestionSelectionInput,
    action: (selection: BulkQuestionSelectionInput) => Promise<ActionResult<BulkQuestionMutationResult>>
  ) {
    startBulkTransition(async () => {
      const result = await action(input)
      if (result.data) {
        selection.applyResult(result.data)
        setLiveMessage(result.message ?? '')
        if (result.success) {
          toast.success(result.message ?? 'Done.')
        } else {
          toast.error(result.message ?? 'Some questions could not be updated.')
        }
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
      router.refresh()
      if (previewId && result.data?.succeededIds.includes(previewId)) {
        void loadDetail(previewId, { force: true })
      }
    })
  }

  const isMutating = isPending || isBulkPending

  // -- Archive confirmation (single row or bulk) ---------------------------------
  const [archiveSelection, setArchiveSelection] = useState<BulkQuestionSelectionInput | null>(null)
  const archiveCount = archiveSelection
    ? archiveSelection.mode === 'explicit'
      ? archiveSelection.ids.length
      : selection.selectedCount
    : 0

  function confirmArchive() {
    if (archiveSelection) {
      runBulkAction(archiveSelection, bulkArchiveQuestionsAction)
    }
    setArchiveSelection(null)
  }

  // -- Move to trash confirmation (single row or bulk) + restore -----------------
  const [trashSelection, setTrashSelection] = useState<BulkQuestionSelectionInput | null>(null)
  const trashCount = trashSelection
    ? trashSelection.mode === 'explicit'
      ? trashSelection.ids.length
      : selection.selectedCount
    : 0

  function confirmTrash() {
    if (trashSelection) {
      runBulkAction(trashSelection, bulkTrashQuestionsAction)
    }
    setTrashSelection(null)
  }

  function restoreSingle(question: AdminQuestionListItem) {
    runStatusAction([question.id], restoreQuestionAction, 'Question restored')
  }

  function restoreBulk() {
    runBulkAction(selection.toSelectionInput(), bulkRestoreQuestionsAction)
  }

  // -- Permanent delete: server-authoritative preview dialog (single row or bulk) --
  const [hardDeleteSelection, setHardDeleteSelection] = useState<BulkQuestionSelectionInput | null>(null)

  function publishToggle(question: AdminQuestionListItem) {
    if (question.status === 'published') {
      runStatusAction([question.id], unpublishQuestionAction, 'Question moved back to draft')
    } else {
      runStatusAction([question.id], publishQuestionAction, 'Question published')
    }
  }

  // Escape clears selection — but only when no dialog/menu is open, and never
  // while focus is inside a text input (so it doesn't fight normal typing).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || selection.selectedCount === 0) {
        return
      }
      if (archiveSelection || trashSelection || hardDeleteSelection) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return
      }
      if (
        target?.closest(
          '[data-slot="dropdown-menu-content"], [data-slot="alert-dialog-content"], [data-slot="dialog-content"]'
        )
      ) {
        return
      }
      selection.clear()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [archiveSelection, trashSelection, hardDeleteSelection, selection])

  // -- Render --------------------------------------------------------------------
  const previewPane = (
    <QuestionPreviewPane
      item={previewItem}
      detail={previewItem ? details[previewItem.id] ?? null : null}
      isLoading={previewLoading}
      error={previewError}
      isBusy={isMutating}
      onPublishToggle={() => previewItem && publishToggle(previewItem)}
      onDuplicate={() => previewItem && runRedirectAction(() => duplicateQuestionAction(previewItem.id))}
      onCreateSimilar={() =>
        previewItem && runRedirectAction(() => createSimilarQuestionAction(previewItem.id))
      }
      onArchive={() => previewItem && setArchiveSelection({ mode: 'explicit', ids: [previewItem.id] })}
      onDelete={() => previewItem && setTrashSelection({ mode: 'explicit', ids: [previewItem.id] })}
      onRestore={() => previewItem && restoreSingle(previewItem)}
      onDeleteForever={() => previewItem && setHardDeleteSelection({ mode: 'explicit', ids: [previewItem.id] })}
      onAssetsChanged={() => previewItem && loadDetail(previewItem.id, { force: true })}
    />
  )

  return (
    <div className="items-start gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

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
              onValueChange={(value) =>
                pushFilters({
                  subjectId: value,
                  topicId: ALL,
                  questionTypeId: ALL,
                  domainCode: ALL,
                  subtopicCode: ALL,
                  skillCode: ALL,
                })
              }
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

            <Select
              value={domainCode}
              onValueChange={(value) => pushFilters({ domainCode: value, subtopicCode: ALL, skillCode: ALL })}
              items={domainItems}
            >
              <SelectTrigger className="w-full" aria-label="Domain">
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(domainItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={subtopicCode}
              onValueChange={(value) => pushFilters({ subtopicCode: value, skillCode: ALL })}
              items={subtopicItems}
            >
              <SelectTrigger className="w-full" aria-label="Subtopic">
                <SelectValue placeholder="All subtopics" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(subtopicItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={skillCode} onValueChange={(value) => pushFilters({ skillCode: value })} items={skillItems}>
              <SelectTrigger className="w-full" aria-label="Skill">
                <SelectValue placeholder="All skills" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(skillItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={questionFamily}
              onValueChange={(value) => pushFilters({ questionFamily: value })}
              items={questionFamilyItems}
            >
              <SelectTrigger className="w-full" aria-label="Question family">
                <SelectValue placeholder="All families" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(questionFamilyItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={stimulusFormat}
              onValueChange={(value) => pushFilters({ stimulusFormat: value })}
              items={stimulusFormatItems}
            >
              <SelectTrigger className="w-full" aria-label="Stimulus type">
                <SelectValue placeholder="All stimulus types" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(stimulusFormatItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={patternKeyInput}
              onChange={(event) => setPatternKeyInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  pushFilters({ patternKey: patternKeyInput.trim() })
                }
              }}
              onBlur={() => {
                if ((filters.patternKey ?? '') !== patternKeyInput.trim()) {
                  pushFilters({ patternKey: patternKeyInput.trim() })
                }
              }}
              placeholder="Pattern key…"
              aria-label="Pattern key"
            />

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

            <Select value={assetState} onValueChange={(value) => pushFilters({ assetState: value })} items={assetItems}>
              <SelectTrigger className="w-full" aria-label="Asset status">
                <SelectValue placeholder="All assets" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(assetItems).map(([value, label]) => (
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

        {/* Sticky bulk action bar */}
        {selection.selectedCount > 0 ? (
          <div className="rounded-2xl border border-brand/30 bg-brand-soft">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">
                {selection.selectedCount} selected
              </p>
              {!hasFullCompositionKnowledge ? (
                <p className="text-xs text-muted-foreground">Actions apply only where they&apos;re valid.</p>
              ) : null}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {!hasFullCompositionKnowledge || checkedQuestions.some((q) => q.status !== 'published') ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => runBulkAction(selection.toSelectionInput(), bulkPublishQuestionsAction)}
                  >
                    <RocketIcon className="size-3.5" />
                    Publish
                  </Button>
                ) : null}
                {!hasFullCompositionKnowledge || checkedQuestions.some((q) => q.status === 'published') ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => runBulkAction(selection.toSelectionInput(), bulkUnpublishQuestionsAction)}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Unpublish
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isMutating}
                  onClick={() => setArchiveSelection(selection.toSelectionInput())}
                >
                  <ArchiveIcon className="size-3.5" />
                  Archive
                </Button>
                {!hasFullCompositionKnowledge || checkedQuestions.some((q) => q.deletedAt) ? (
                  <Button size="sm" variant="outline" disabled={isMutating} onClick={restoreBulk}>
                    <Undo2Icon className="size-3.5" />
                    Restore
                  </Button>
                ) : null}
                {!hasFullCompositionKnowledge || checkedQuestions.some((q) => !q.deletedAt) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => setTrashSelection(selection.toSelectionInput())}
                  >
                    <Trash2Icon className="size-3.5" />
                    Move to trash
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={isMutating}
                  onClick={() => setHardDeleteSelection(selection.toSelectionInput())}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete forever
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting}
                  onClick={() => runExport(selection.toSelectionInput())}
                >
                  <DownloadIcon className="size-3.5" />
                  Export selected
                </Button>
                <Button size="sm" variant="ghost" onClick={selection.clear}>
                  Clear
                </Button>
              </div>
            </div>
            {selection.state.mode === 'explicit' && selection.headerState === 'checked' ? (
              <SelectAllMatchingBanner
                visibleCount={visibleIds.length}
                totalCount={data.totalCount}
                filters={filters}
                onSelectAllMatching={(preview: BulkSelectionPreview) =>
                  selection.selectAllMatching(filters, preview.cutoffTimestamp, preview.matchedCount)
                }
              />
            ) : null}
          </div>
        ) : null}

        {/* List */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                aria-label="Select all questions on this page"
                className="size-4 accent-primary"
                checked={selection.headerState === 'checked'}
                onChange={selection.toggleAll}
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.totalCount}</span> question
                {data.totalCount === 1 ? '' : 's'}
                {hasActiveFilters ? ' match' : ''}
                <span className="hidden sm:inline">
                  {' '}
                  · {statusCounts.published} published · {statusCounts.draft} draft ·{' '}
                  {statusCounts.archived} archived
                  {statusCounts.deleted > 0 ? ` · ${statusCounts.deleted} in trash` : ''}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <GenerateMissingAssetsButton
                variant="ghost"
                className="text-muted-foreground"
                onGenerated={() => previewId && loadDetail(previewId, { force: true })}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={isExporting}
                onClick={() => runExport()}
              >
                <DownloadIcon className="size-3.5" />
                Export CSV
              </Button>
            </div>
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
                  isChecked={selection.isSelected(question.id)}
                  isBusy={isMutating}
                  onSelect={() => {
                    setPreviewId(question.id)
                    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
                      setSheetOpen(true)
                    }
                  }}
                  onCheckedChange={(checked, shiftKey) => selection.toggle(question.id, checked, shiftKey)}
                  onPublishToggle={() => publishToggle(question)}
                  onDuplicate={() => runRedirectAction(() => duplicateQuestionAction(question.id))}
                  onCreateSimilar={() =>
                    runRedirectAction(() => createSimilarQuestionAction(question.id))
                  }
                  onArchive={() => setArchiveSelection({ mode: 'explicit', ids: [question.id] })}
                  onDelete={() => setTrashSelection({ mode: 'explicit', ids: [question.id] })}
                  onRestore={() => restoreSingle(question)}
                  onDeleteForever={() => setHardDeleteSelection({ mode: 'explicit', ids: [question.id] })}
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
              isAllPageSize={
                filters.pageSize === ADMIN_QUESTION_ALL_PAGE_SIZE_VALUE && data.totalCount <= ADMIN_QUESTION_ALL_PAGE_SIZE_LIMIT
              }
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
      <AlertDialog open={archiveSelection !== null} onOpenChange={(open) => !open && setArchiveSelection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {archiveCount > 1 ? `${archiveCount} questions` : 'this question'}?
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

      {/* -- Move to trash confirmation --------------------------------------- */}
      <AlertDialog open={trashSelection !== null} onOpenChange={(open) => !open && setTrashSelection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {trashCount > 1 ? `${trashCount} questions` : 'this question'} to trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Only archived questions can be trashed — anything else in this selection is skipped and
              reported after. Trashed questions no longer appear in student practice or normal admin
              lists. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTrash}>Move to trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Permanent delete: server-authoritative preview + typed confirmation --- */}
      <BulkDeleteQuestionsDialog
        selection={hardDeleteSelection}
        selectionDescription={
          hardDeleteSelection ? describeSelection(hardDeleteSelection, hardDeleteSelection.mode === 'explicit' ? hardDeleteSelection.ids.length : selection.selectedCount) : ''
        }
        onOpenChange={(open) => !open && setHardDeleteSelection(null)}
        onCompleted={(result) => {
          selection.applyResult(result)
          if (result.failed.length === 0) {
            const message = `${result.succeededCount} question${result.succeededCount === 1 ? '' : 's'} permanently deleted.`
            setLiveMessage(message)
            toast.success(message)
          } else {
            const message = `${result.succeededCount} deleted, ${result.failed.length} kept safe.`
            setLiveMessage(message)
            toast.error(message)
          }
          if (result.warnings) {
            for (const warning of result.warnings) {
              toast.warning(warning.message)
            }
          }
          router.refresh()
        }}
      />
    </div>
  )
}
