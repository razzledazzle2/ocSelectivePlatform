'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  addMockQuestionsAction,
  assistedMockSuggestionsAction,
  searchBankQuestionsAction,
} from '@/app/admin/mocks/actions'
import { QuestionStatusBadge } from '@/components/admin/question-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import type {
  AdminQuestionsPage,
  SubjectRecord,
  TopicRecord,
} from '@/lib/types'

const ALL = 'all'
type PickerMode = 'search' | 'assisted'
const difficultyValues = ['1', '2', '3', '4', '5'] as const

interface MockQuestionPickerProps {
  mockTestId: string
  /** Section receiving the questions; null keeps the dialog closed. */
  section: { id: string; name: string; subjectId: string | null } | null
  /** Question ids already anywhere in the mock (shown as "In mock"). */
  existingQuestionIds: Set<string>
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  tags: string[]
  onClose: () => void
  onAdded: () => void
}

/**
 * Search-and-select dialog for pulling bank questions into a mock section.
 * Defaults to the section's subject and published questions, since only
 * published questions are student-safe.
 */
export function MockQuestionPicker({
  mockTestId,
  section,
  existingQuestionIds,
  subjects,
  topics,
  tags,
  onClose,
  onAdded,
}: MockQuestionPickerProps) {
  const [isAdding, startAdding] = useTransition()

  const [mode, setMode] = useState<PickerMode>('search')
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState(ALL)
  const [topicId, setTopicId] = useState(ALL)
  const [tag, setTag] = useState(ALL)
  const [difficulty, setDifficulty] = useState(ALL)
  const [status, setStatus] = useState('published')
  const [page, setPage] = useState(1)
  const [assistCount, setAssistCount] = useState('10')

  const [results, setResults] = useState<AdminQuestionsPage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const requestSeq = useRef(0)

  const open = section !== null

  // Reset per section open; default the subject filter to the section's subject.
  useEffect(() => {
    if (section) {
      setMode('search')
      setQuery('')
      setSubjectId(section.subjectId ?? ALL)
      setTopicId(ALL)
      setTag(ALL)
      setDifficulty(ALL)
      setStatus('published')
      setPage(1)
      setAssistCount('10')
      setResults(null)
      setSelectedIds(new Set())
    }
  }, [section])

  const search = useCallback(
    async (nextPage: number) => {
      const requestId = ++requestSeq.current
      setIsLoading(true)
      setLoadError(null)
      const result = await searchBankQuestionsAction({
        query: query.trim() || undefined,
        subjectId: subjectId === ALL ? undefined : subjectId,
        topicId: topicId === ALL ? undefined : topicId,
        tag: tag === ALL ? undefined : tag,
        difficulty: difficulty === ALL ? undefined : difficulty,
        status: status === ALL ? undefined : status,
        page: String(nextPage),
      })
      if (requestId !== requestSeq.current) {
        return
      }
      setIsLoading(false)
      if (result.success && result.data) {
        setResults(result.data)
        setPage(result.data.page)
      } else {
        setLoadError(result.message ?? 'Unable to search the question bank.')
      }
    },
    [query, subjectId, topicId, tag, difficulty, status]
  )

  useEffect(() => {
    if (open && mode === 'search') {
      void search(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, subjectId, topicId, tag, difficulty, status])

  /** Assisted selection: suggest published questions matching the targets, pre-ticked for review. */
  const runAssist = useCallback(async () => {
    const requestId = ++requestSeq.current
    setIsLoading(true)
    setLoadError(null)
    const result = await assistedMockSuggestionsAction({
      subjectId: subjectId === ALL ? undefined : subjectId,
      topicId: topicId === ALL ? undefined : topicId,
      difficulty: difficulty === ALL ? undefined : difficulty,
      count: Number(assistCount) || 10,
      excludeQuestionIds: [...existingQuestionIds],
    })
    if (requestId !== requestSeq.current) {
      return
    }
    setIsLoading(false)
    if (result.success && result.data) {
      const items = result.data.questions
      setResults({ items, totalCount: items.length, page: 1, pageSize: items.length || 1, pageCount: 1 })
      setSelectedIds(new Set(items.map((question) => question.id)))
      if (items.length === 0) {
        toast.info('No matching published questions were found for those targets.')
      }
    } else {
      setLoadError(result.message ?? 'Unable to build suggestions from the question bank.')
    }
  }, [subjectId, topicId, difficulty, assistCount, existingQuestionIds])

  const filteredTopics = subjectId === ALL ? topics : topics.filter((topic) => topic.subject_id === subjectId)

  const subjectItems = { [ALL]: 'All subjects', ...Object.fromEntries(subjects.map((s) => [s.id, s.name])) }
  const topicItems = { [ALL]: 'All topics', ...Object.fromEntries(filteredTopics.map((t) => [t.id, t.name])) }
  const tagItems = { [ALL]: 'All tags', ...Object.fromEntries(tags.map((t) => [t, t])) }
  const difficultyItems = {
    [ALL]: 'All difficulties',
    ...Object.fromEntries(difficultyValues.map((v) => [v, `Difficulty ${v}`])),
  }
  const statusItems = { published: 'Published', draft: 'Draft', [ALL]: 'Any status' }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function addSelected() {
    if (!section || selectedIds.size === 0) {
      return
    }
    startAdding(async () => {
      const result = await addMockQuestionsAction(mockTestId, section.id, [...selectedIds])
      if (result.success) {
        toast.success(result.message ?? 'Questions added.')
        onAdded()
        onClose()
      } else {
        toast.error(result.message ?? 'Unable to add the questions.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add questions to {section?.name}</DialogTitle>
          <DialogDescription>
            Search the bank yourself, or let assisted selection suggest a set to review. Draft
            questions can be added while you build, but publish them before publishing the mock.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="inline-flex w-fit rounded-lg border border-border bg-muted p-1">
          {(['search', 'assisted'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={
                mode === value
                  ? 'rounded-md bg-card px-3 py-1 text-xs font-medium capitalize text-foreground shadow-sm'
                  : 'rounded-md px-3 py-1 text-xs font-medium capitalize text-muted-foreground hover:text-foreground'
              }
            >
              {value === 'search' ? 'Search bank' : 'Assisted'}
            </button>
          ))}
        </div>

        {/* Filters */}
        {mode === 'search' ? (
          <div className="space-y-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void search(1)
              }}
            >
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search question text…"
                  className="pl-8"
                  aria-label="Search questions"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  { value: subjectId, set: (v: string) => { setSubjectId(v); setTopicId(ALL) }, items: subjectItems, label: 'Subject' },
                  { value: topicId, set: setTopicId, items: topicItems, label: 'Topic' },
                  { value: tag, set: setTag, items: tagItems, label: 'Tag' },
                  { value: difficulty, set: setDifficulty, items: difficultyItems, label: 'Difficulty' },
                  { value: status, set: setStatus, items: statusItems, label: 'Status' },
                ] as const
              ).map((filter) => (
                <Select key={filter.label} value={filter.value} onValueChange={filter.set} items={filter.items}>
                  <SelectTrigger className="h-8 w-full text-xs" aria-label={filter.label}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(filter.items).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Set targets and suggest published questions to review. Nothing is added until you confirm.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { value: subjectId, set: (v: string) => { setSubjectId(v); setTopicId(ALL) }, items: subjectItems, label: 'Subject' },
                  { value: topicId, set: setTopicId, items: topicItems, label: 'Topic' },
                  { value: difficulty, set: setDifficulty, items: difficultyItems, label: 'Difficulty' },
                ] as const
              ).map((filter) => (
                <Select key={filter.label} value={filter.value} onValueChange={filter.set} items={filter.items}>
                  <SelectTrigger className="h-8 w-full text-xs" aria-label={filter.label}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(filter.items).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
              <div className="flex items-center gap-1.5">
                <Label htmlFor="assist-count" className="text-xs text-muted-foreground">
                  How many
                </Label>
                <Input
                  id="assist-count"
                  value={assistCount}
                  onChange={(event) => setAssistCount(event.target.value)}
                  inputMode="numeric"
                  className="h-8 w-16 text-xs"
                  aria-label="Number of questions to suggest"
                />
              </div>
            </div>
            <Button type="button" size="sm" disabled={isLoading} onClick={() => void runAssist()}>
              {isLoading ? 'Suggesting…' : 'Suggest questions'}
            </Button>
          </div>
        )}

        {/* Results */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)
          ) : loadError ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">{loadError}</p>
          ) : !results || results.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No questions match these filters.
            </p>
          ) : (
            results.items.map((question) => {
              const inMock = existingQuestionIds.has(question.id)
              const checked = selectedIds.has(question.id)
              return (
                <label
                  key={question.id}
                  className={
                    inMock
                      ? 'flex cursor-not-allowed items-start gap-3 rounded-lg px-3 py-2 opacity-50'
                      : 'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/50'
                  }
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={inMock || isAdding}
                    onChange={() => toggleSelected(question.id)}
                    aria-label={`Select question ${question.questionTextPreview.slice(0, 40)}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm text-foreground">
                      {question.questionTextPreview}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{question.subjectName}</span>
                      <span aria-hidden>·</span>
                      <span>{question.topicName}</span>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
                        D{question.difficulty}
                      </Badge>
                      <QuestionStatusBadge status={question.status} />
                      {inMock ? (
                        <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem]">
                          In mock
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </label>
              )
            })
          )}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {results ? (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={isLoading || page <= 1}
                  onClick={() => void search(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="tabular-nums">
                  Page {results.page} of {results.pageCount} · {results.totalCount} match
                  {results.totalCount === 1 ? '' : 'es'}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={isLoading || page >= results.pageCount}
                  onClick={() => void search(page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isAdding || selectedIds.size === 0} onClick={addSelected}>
              <PlusIcon className="size-4" />
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}question
              {selectedIds.size === 1 ? '' : 's'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
