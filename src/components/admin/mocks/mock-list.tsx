'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ArchiveIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  RotateCcwIcon,
  TimerIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createMockTestAction,
  duplicateMockTestAction,
  setMockTestStatusAction,
  updateMockDisplayOrderAction,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Textarea } from '@/components/ui/textarea'
import { MOCK_TYPE_LABELS, MOCK_TYPES, type MockTestListItem } from '@/lib/mock-tests/types'
import { EXAM_TYPES, type ActionResult } from '@/lib/types'

const updatedFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDurationMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

interface MockListProps {
  mocks: MockTestListItem[]
}

/** Admin list of curated mock tests with lifecycle actions and a create dialog. */
export function MockList({ mocks }: MockListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [examType, setExamType] = useState<string>(EXAM_TYPES[0])
  const [yearLevel, setYearLevel] = useState('')
  const [mockType, setMockType] = useState<string>('full_mock')

  const examItems = Object.fromEntries(EXAM_TYPES.map((value) => [value, value]))
  const mockTypeItems = Object.fromEntries(MOCK_TYPES.map((value) => [value, MOCK_TYPE_LABELS[value]]))

  function run(action: () => Promise<ActionResult<{ redirectTo: string } | undefined>>) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(result.message ?? 'Done.')
        if (result.data && 'redirectTo' in (result.data as object)) {
          router.push((result.data as { redirectTo: string }).redirectTo)
        }
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  function submitCreate() {
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('examType', examType)
    formData.set('yearLevel', yearLevel)
    formData.set('mockType', mockType)
    startTransition(async () => {
      const result = await createMockTestAction(formData)
      if (result.success && result.data) {
        toast.success(result.message ?? 'Mock created.')
        setCreateOpen(false)
        router.push(result.data.redirectTo)
      } else {
        toast.error(result.message ?? 'Unable to create the mock test.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          New mock test
        </Button>
      </div>

      {mocks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <TimerIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">No mock tests yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Create your first mock test to hand-pick questions into the full exam structure — Reading,
            Mathematical Reasoning, Thinking Skills and Writing with timed breaks in between.
          </p>
          <Button size="sm" className="mt-1" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Create a mock test
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mock test</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Order</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mocks.map((mock) => (
                <TableRow key={mock.id} className="group">
                  <TableCell>
                    <Link
                      href={`/admin/mocks/${mock.id}`}
                      className="font-medium text-foreground hover:text-brand hover:underline"
                    >
                      {mock.title}
                    </Link>
                    {mock.description ? (
                      <p className="mt-0.5 line-clamp-1 max-w-72 text-xs text-muted-foreground">
                        {mock.description}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
                        {MOCK_TYPE_LABELS[mock.mockType]}
                      </Badge>
                      {mock.difficultyLabel ? (
                        <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem]">
                          {mock.difficultyLabel}
                        </Badge>
                      ) : null}
                      {mock.subjectMix.slice(0, 4).map((share) => (
                        <span key={share.subjectName} className="text-[0.65rem] text-muted-foreground">
                          {share.subjectName} · {share.count}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuestionStatusBadge status={mock.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{mock.examType}</Badge>
                    {mock.yearLevel ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">Yr {mock.yearLevel}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{mock.questionCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDurationMinutes(mock.estimatedDurationSeconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {mock.attemptsCount > 0 ? mock.attemptsCount : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {mock.averageAccuracy !== null ? (
                      `${mock.averageAccuracy}%`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <MockOrderInput mockId={mock.id} value={mock.displayOrder} disabled={isPending} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {updatedFormatter.format(new Date(mock.updatedAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" disabled={isPending} />}
                      >
                        <MoreHorizontalIcon className="size-4" />
                        <span className="sr-only">Mock actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem render={<Link href={`/admin/mocks/${mock.id}`} />}>
                          <PencilIcon className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => duplicateMockTestAction(mock.id))}>
                          <CopyIcon className="size-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {mock.status === 'published' ? (
                          <DropdownMenuItem
                            onClick={() => run(() => setMockTestStatusAction(mock.id, 'draft'))}
                          >
                            <RotateCcwIcon className="size-4" />
                            Unpublish
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => run(() => setMockTestStatusAction(mock.id, 'published'))}
                            disabled={mock.questionCount === 0}
                          >
                            <RocketIcon className="size-4" />
                            Publish
                          </DropdownMenuItem>
                        )}
                        {mock.status !== 'archived' ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => run(() => setMockTestStatusAction(mock.id, 'archived'))}
                          >
                            <ArchiveIcon className="size-4" />
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => run(() => setMockTestStatusAction(mock.id, 'draft'))}
                          >
                            <RotateCcwIcon className="size-4" />
                            Restore to draft
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* -- Create dialog ---------------------------------------------------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New mock test</DialogTitle>
            <DialogDescription>
              Starts as a draft with the full exam structure — Reading, 5 min break, Mathematical
              Reasoning, 10 min break, Thinking Skills, 5 min break, Writing. You&apos;ll add
              questions next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mock-title">Title</Label>
              <Input
                id="mock-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Selective Trial Exam 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-description">Description (optional)</Label>
              <Textarea
                id="mock-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this mock covers, who it's for…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="mock-year">Year level (optional)</Label>
                <Input
                  id="mock-year"
                  value={yearLevel}
                  onChange={(event) => setYearLevel(event.target.value)}
                  placeholder="e.g. 6"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || !title.trim()} onClick={submitCreate}>
              <PlusIcon className="size-4" />
              Create mock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Inline student-list ordering: commits on blur (or Enter) when the value changes. */
function MockOrderInput({ mockId, value, disabled }: { mockId: string; value: number; disabled: boolean }) {
  const [order, setOrder] = useState(String(value))
  const [isSaving, startSaving] = useTransition()

  function commit() {
    const parsed = Number(order)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed === value) {
      setOrder(String(value))
      return
    }
    startSaving(async () => {
      const result = await updateMockDisplayOrderAction(mockId, parsed)
      if (!result.success) {
        toast.error(result.message ?? 'Unable to update the order.')
        setOrder(String(value))
      }
    })
  }

  return (
    <Input
      value={order}
      onChange={(event) => setOrder(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
      disabled={disabled || isSaving}
      inputMode="numeric"
      aria-label="Display order"
      className="ml-auto h-8 w-14 text-right tabular-nums"
    />
  )
}
