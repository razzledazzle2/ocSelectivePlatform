'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MergeIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createQuestionTypeAction,
  createSubjectAction,
  createTopicAction,
  mergeTopicsAction,
  renameTagAction,
  renameTaxonomyAction,
  toggleTaxonomyActiveAction,
} from '@/app/admin/taxonomy/actions'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TaxonomyStatusBreakdown, TaxonomyUsage } from '@/lib/questions/taxonomy-stats'
import type { ActionResult, QuestionTypeRecord, SubjectRecord, TopicRecord } from '@/lib/types'
import type { OptionCountRule } from '@/lib/questions/option-rules'
import { cn } from '@/lib/utils'

interface TaxonomyManagerProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  usage: TaxonomyUsage
  optionRules: OptionCountRule[]
  defaultOptionRule: OptionCountRule
}

type TaxonomyTable = 'subjects' | 'topics' | 'question_types'

const NO_TOPIC = 'none'

const EMPTY_BREAKDOWN: TaxonomyStatusBreakdown = { total: 0, published: 0, draft: 0, archived: 0 }

function UsageCell({ breakdown }: { breakdown: TaxonomyStatusBreakdown }) {
  if (breakdown.total === 0) {
    return (
      <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
        Unused
      </Badge>
    )
  }
  return (
    <span className="text-sm tabular-nums text-foreground">
      {breakdown.total}
      <span className="ml-1.5 text-xs text-muted-foreground">
        ({breakdown.published} published · {breakdown.draft} draft
        {breakdown.archived > 0 ? ` · ${breakdown.archived} archived` : ''})
      </span>
    </span>
  )
}

/**
 * Taxonomy workspace: subjects as overview cards, then the selected subject's
 * topics, question types and tags with REAL usage counts from the bank.
 * Nothing is hard-deleted — used items are renamed, merged or archived.
 */
export function TaxonomyManager({
  subjects,
  topics,
  questionTypes,
  usage,
  optionRules,
  defaultOptionRule,
}: TaxonomyManagerProps) {
  const [isPending, startTransition] = useTransition()

  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id ?? '')
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null

  // -- Add forms ---------------------------------------------------------------
  const [subjectName, setSubjectName] = useState('')
  const [topicName, setTopicName] = useState('')
  const [typeName, setTypeName] = useState('')
  const [typeTopicId, setTypeTopicId] = useState(NO_TOPIC)

  // -- Dialogs -----------------------------------------------------------------
  const [renameTarget, setRenameTarget] = useState<{ table: TaxonomyTable; id: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [mergeSource, setMergeSource] = useState<TopicRecord | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<{
    table: TaxonomyTable
    id: string
    name: string
    inUseCount: number
  } | null>(null)
  const [tagRename, setTagRename] = useState<{ tag: string; count: number } | null>(null)
  const [tagRenameValue, setTagRenameValue] = useState('')

  const subjectTopics = useMemo(
    () => topics.filter((topic) => topic.subject_id === selectedSubjectId),
    [topics, selectedSubjectId]
  )
  const subjectTypes = useMemo(
    () => questionTypes.filter((type) => type.subject_id === selectedSubjectId),
    [questionTypes, selectedSubjectId]
  )
  const subjectTags = useMemo(() => {
    const tags = usage.tagsBySubject[selectedSubjectId] ?? {}
    return Object.entries(tags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [usage.tagsBySubject, selectedSubjectId])

  const topicNameById = useMemo(() => new Map(topics.map((topic) => [topic.id, topic.name])), [topics])

  const typeTopicItems = useMemo(
    () => ({
      [NO_TOPIC]: 'Subject-wide (no topic)',
      ...Object.fromEntries(subjectTopics.filter((t) => t.is_active).map((topic) => [topic.id, topic.name])),
    }),
    [subjectTopics]
  )
  const mergeTargetItems = useMemo(
    () =>
      Object.fromEntries(
        subjectTopics
          .filter((topic) => topic.is_active && topic.id !== mergeSource?.id)
          .map((topic) => [topic.id, topic.name])
      ),
    [subjectTopics, mergeSource]
  )

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(result.message ?? 'Done.')
        onOk?.()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  function openRename(table: TaxonomyTable, id: string, name: string) {
    setRenameTarget({ table, id, name })
    setRenameValue(name)
  }

  function requestArchive(table: TaxonomyTable, id: string, name: string, inUseCount: number) {
    if (inUseCount > 0) {
      setArchiveTarget({ table, id, name, inUseCount })
    } else {
      run(() => toggleTaxonomyActiveAction(table, id, false))
    }
  }

  return (
    <Tabs defaultValue="structure">
      <TabsList>
        <TabsTrigger value="structure">Subjects &amp; categories</TabsTrigger>
        <TabsTrigger value="rules">Option rules</TabsTrigger>
      </TabsList>

      <TabsContent value="structure" className="space-y-6 pt-5">
        {/* -- Subject overview cards -------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {subjects.map((subject) => {
            const breakdown = usage.subjects[subject.id] ?? EMPTY_BREAKDOWN
            const topicCount = topics.filter((topic) => topic.subject_id === subject.id).length
            const tagCount = Object.keys(usage.tagsBySubject[subject.id] ?? {}).length
            const isSelected = subject.id === selectedSubjectId
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => {
                  setSelectedSubjectId(subject.id)
                  setTypeTopicId(NO_TOPIC)
                }}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  isSelected
                    ? 'border-brand/50 bg-brand-soft/60 shadow-sm ring-1 ring-brand/30'
                    : 'border-border bg-card shadow-sm hover:border-brand/30 hover:shadow'
                )}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{subject.name}</p>
                  {!subject.is_active ? (
                    <Badge variant="outline" className="text-[0.65rem]">
                      Archived
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {breakdown.total}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">questions</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {breakdown.published} published · {breakdown.draft} draft
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {topicCount} categor{topicCount === 1 ? 'y' : 'ies'} · {tagCount} tag{tagCount === 1 ? '' : 's'}
                </p>
              </button>
            )
          })}

          {/* New subject card */}
          <div className="flex flex-col justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-4">
            <Label htmlFor="subject-name" className="text-xs text-muted-foreground">
              New subject
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="subject-name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="e.g. Reading"
                className="h-8"
              />
              <Button
                type="button"
                size="icon-sm"
                disabled={isPending || !subjectName.trim()}
                onClick={() => {
                  const formData = new FormData()
                  formData.set('name', subjectName)
                  run(() => createSubjectAction(formData), () => setSubjectName(''))
                }}
                aria-label="Add subject"
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {selectedSubject ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0 space-y-6">
              {/* -- Topics/categories -------------------------------------- */}
              <Card className="rounded-2xl shadow-sm ring-border">
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <CardTitle>Categories in {selectedSubject.name}</CardTitle>
                      <CardDescription>
                        Student-facing categories (topics). Merge or archive instead of deleting —
                        existing questions keep their history.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={topicName}
                        onChange={(event) => setTopicName(event.target.value)}
                        placeholder="New category…"
                        className="h-8 w-44"
                        aria-label="New category name"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending || !topicName.trim()}
                        onClick={() => {
                          const formData = new FormData()
                          formData.set('subjectId', selectedSubject.id)
                          formData.set('name', topicName)
                          run(() => createTopicAction(formData), () => setTopicName(''))
                        }}
                      >
                        <PlusIcon className="size-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {subjectTopics.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No categories yet. Add one above, or import questions — imports can create
                      categories automatically for you to tidy here.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Questions</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subjectTopics.map((topic) => {
                            const breakdown = usage.topics[topic.id] ?? EMPTY_BREAKDOWN
                            return (
                              <TableRow key={topic.id} className={topic.is_active ? undefined : 'opacity-60'}>
                                <TableCell className="font-medium text-foreground">{topic.name}</TableCell>
                                <TableCell>
                                  <UsageCell breakdown={breakdown} />
                                </TableCell>
                                <TableCell>
                                  <Badge variant={topic.is_active ? 'default' : 'outline'}>
                                    {topic.is_active ? 'Active' : 'Archived'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={isPending}
                                      onClick={() => openRename('topics', topic.id, topic.name)}
                                      aria-label={`Rename ${topic.name}`}
                                    >
                                      <PencilIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={isPending || subjectTopics.filter((t) => t.is_active).length < 2}
                                      onClick={() => {
                                        setMergeSource(topic)
                                        setMergeTargetId('')
                                      }}
                                      aria-label={`Merge ${topic.name} into another category`}
                                    >
                                      <MergeIcon className="size-3.5" />
                                    </Button>
                                    {topic.is_active ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={isPending}
                                        onClick={() =>
                                          requestArchive('topics', topic.id, topic.name, breakdown.total)
                                        }
                                        aria-label={`Archive ${topic.name}`}
                                      >
                                        <ArchiveIcon className="size-3.5" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={isPending}
                                        onClick={() => run(() => toggleTaxonomyActiveAction('topics', topic.id, true))}
                                        aria-label={`Restore ${topic.name}`}
                                      >
                                        <ArchiveRestoreIcon className="size-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* -- Question types ------------------------------------------ */}
              <Card className="rounded-2xl shadow-sm ring-border">
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <CardTitle>Question types</CardTitle>
                      <CardDescription>
                        Fine-grained skills like “Percentage of a quantity”, optionally scoped to a category.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={typeTopicId} onValueChange={setTypeTopicId} items={typeTopicItems}>
                        <SelectTrigger className="h-8 w-44 text-xs" aria-label="Category for new question type">
                          <SelectValue placeholder="Subject-wide" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(typeTopicItems).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={typeName}
                        onChange={(event) => setTypeName(event.target.value)}
                        placeholder="New question type…"
                        className="h-8 w-44"
                        aria-label="New question type name"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending || !typeName.trim()}
                        onClick={() => {
                          const formData = new FormData()
                          formData.set('subjectId', selectedSubject.id)
                          if (typeTopicId !== NO_TOPIC) {
                            formData.set('topicId', typeTopicId)
                          }
                          formData.set('name', typeName)
                          run(() => createQuestionTypeAction(formData), () => setTypeName(''))
                        }}
                      >
                        <PlusIcon className="size-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {subjectTypes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No question types for this subject yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Question type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Questions</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subjectTypes.map((type) => {
                            const breakdown = usage.questionTypes[type.id] ?? EMPTY_BREAKDOWN
                            return (
                              <TableRow key={type.id} className={type.is_active ? undefined : 'opacity-60'}>
                                <TableCell className="font-medium text-foreground">{type.name}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {type.topic_id ? topicNameById.get(type.topic_id) ?? '—' : 'Subject-wide'}
                                </TableCell>
                                <TableCell>
                                  <UsageCell breakdown={breakdown} />
                                </TableCell>
                                <TableCell>
                                  <Badge variant={type.is_active ? 'default' : 'outline'}>
                                    {type.is_active ? 'Active' : 'Archived'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={isPending}
                                      onClick={() => openRename('question_types', type.id, type.name)}
                                      aria-label={`Rename ${type.name}`}
                                    >
                                      <PencilIcon className="size-3.5" />
                                    </Button>
                                    {type.is_active ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={isPending}
                                        onClick={() =>
                                          requestArchive('question_types', type.id, type.name, breakdown.total)
                                        }
                                        aria-label={`Archive ${type.name}`}
                                      >
                                        <ArchiveIcon className="size-3.5" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={isPending}
                                        onClick={() =>
                                          run(() => toggleTaxonomyActiveAction('question_types', type.id, true))
                                        }
                                        aria-label={`Restore ${type.name}`}
                                      >
                                        <ArchiveRestoreIcon className="size-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* -- Right rail: subject meta + tags ------------------------------ */}
            <div className="space-y-6">
              <Card className="rounded-2xl shadow-sm ring-border">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="flex items-center gap-2">
                    <TagIcon className="size-4 text-muted-foreground" />
                    Tags in {selectedSubject.name}
                  </CardTitle>
                  <CardDescription>
                    Questions can carry multiple tags (e.g. both “Decimals” and “Perimeter”). Rename a
                    tag to the same name as another to merge them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {subjectTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tags in use for this subject yet. Tags are added on the question form and via
                      import.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {subjectTags.map(([tag, count]) => (
                        <li
                          key={tag}
                          className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge variant="secondary" className="max-w-48 truncate">
                              {tag}
                            </Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {count} question{count === 1 ? '' : 's'}
                            </span>
                            {usage.tagTotals[tag] !== count ? (
                              <span className="text-[0.65rem] text-muted-foreground/70">
                                ({usage.tagTotals[tag]} bank-wide)
                              </span>
                            ) : null}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                            disabled={isPending}
                            onClick={() => {
                              setTagRename({ tag, count: usage.tagTotals[tag] ?? count })
                              setTagRenameValue(tag)
                            }}
                            aria-label={`Rename tag ${tag}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm ring-border">
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Subject settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={isPending}
                    onClick={() => openRename('subjects', selectedSubject.id, selectedSubject.name)}
                  >
                    <PencilIcon className="size-3.5" />
                    Rename subject
                  </Button>
                  {selectedSubject.is_active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isPending}
                      onClick={() =>
                        requestArchive(
                          'subjects',
                          selectedSubject.id,
                          selectedSubject.name,
                          (usage.subjects[selectedSubject.id] ?? EMPTY_BREAKDOWN).total
                        )
                      }
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive subject
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isPending}
                      onClick={() => run(() => toggleTaxonomyActiveAction('subjects', selectedSubject.id, true))}
                    >
                      <ArchiveRestoreIcon className="size-3.5" />
                      Restore subject
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Create your first subject to start organising the bank.
          </p>
        )}
      </TabsContent>

      {/* -- Option rules (read-only, code-configured) ---------------------- */}
      <TabsContent value="rules" className="pt-5">
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Option count rules</CardTitle>
            <CardDescription>
              How many answer options each subject expects. These are configured centrally in{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">src/lib/questions/option-rules.ts</code>{' '}
              and applied in the manual editor and every import.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject match</TableHead>
                    <TableHead>Allowed counts</TableHead>
                    <TableHead>Preferred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optionRules.map((rule) => (
                    <TableRow key={rule.label}>
                      <TableCell className="font-medium text-foreground">{rule.label}</TableCell>
                      <TableCell>{rule.allowedCounts.join(' or ')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rule.preferredCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium text-foreground">
                      Any other subject <span className="text-muted-foreground">(default)</span>
                    </TableCell>
                    <TableCell>{defaultOptionRule.allowedCounts.join(' or ')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{defaultOptionRule.preferredCount}</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* -- Rename dialog --------------------------------------------------- */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename “{renameTarget?.name}”</DialogTitle>
            <DialogDescription>
              Existing questions keep pointing at this item, so the new name applies everywhere
              immediately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            aria-label="New name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !renameValue.trim() || renameValue.trim() === renameTarget?.name}
              onClick={() => {
                if (renameTarget) {
                  run(
                    () => renameTaxonomyAction(renameTarget.table, renameTarget.id, renameValue),
                    () => setRenameTarget(null)
                  )
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Merge topics dialog ---------------------------------------------- */}
      <Dialog open={mergeSource !== null} onOpenChange={(open) => !open && setMergeSource(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge “{mergeSource?.name}” into another category</DialogTitle>
            <DialogDescription>
              Every question and question type filed under “{mergeSource?.name}” moves to the category
              you choose, then “{mergeSource?.name}” is archived. Use this to clean up duplicates like
              “Decimal” vs “Decimals”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Merge into</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId} items={mergeTargetItems}>
              <SelectTrigger className="w-full" aria-label="Target category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(mergeTargetItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mergeSource ? (
              <p className="text-xs text-muted-foreground">
                {(usage.topics[mergeSource.id] ?? EMPTY_BREAKDOWN).total} question
                {(usage.topics[mergeSource.id] ?? EMPTY_BREAKDOWN).total === 1 ? '' : 's'} will move.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !mergeTargetId}
              onClick={() => {
                if (mergeSource && mergeTargetId) {
                  run(() => mergeTopicsAction(mergeSource.id, mergeTargetId), () => setMergeSource(null))
                }
              }}
            >
              <MergeIcon className="size-4" />
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Archive-in-use confirmation --------------------------------------- */}
      <Dialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive “{archiveTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {archiveTarget?.inUseCount} question{archiveTarget?.inUseCount === 1 ? '' : 's'} still use
              this item. Archiving hides it from pickers and imports but keeps those questions filed
              under it — nothing is deleted. If it duplicates another category, merging is usually the
              better fix.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (archiveTarget) {
                  run(
                    () => toggleTaxonomyActiveAction(archiveTarget.table, archiveTarget.id, false),
                    () => setArchiveTarget(null)
                  )
                }
              }}
            >
              <ArchiveIcon className="size-4" />
              Archive anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Rename/merge tag dialog -------------------------------------------- */}
      <Dialog open={tagRename !== null} onOpenChange={(open) => !open && setTagRename(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename tag “{tagRename?.tag}”</DialogTitle>
            <DialogDescription>
              Updates {tagRename?.count} question{tagRename?.count === 1 ? '' : 's'} across the whole
              bank. Renaming to an existing tag merges the two.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={tagRenameValue}
            onChange={(event) => setTagRenameValue(event.target.value)}
            aria-label="New tag name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagRename(null)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !tagRenameValue.trim() || tagRenameValue.trim() === tagRename?.tag}
              onClick={() => {
                if (tagRename) {
                  run(() => renameTagAction(tagRename.tag, tagRenameValue), () => setTagRename(null))
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
