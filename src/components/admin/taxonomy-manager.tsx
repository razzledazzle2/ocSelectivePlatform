'use client'

import { useMemo, useState, useTransition } from 'react'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  createQuestionTypeAction,
  createSubjectAction,
  createTopicAction,
  toggleTaxonomyActiveAction,
} from '@/app/admin/taxonomy/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ActionResult, QuestionTypeRecord, SubjectRecord, TopicRecord } from '@/lib/types'
import type { OptionCountRule } from '@/lib/questions/option-rules'

interface TaxonomyManagerProps {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  optionRules: OptionCountRule[]
  defaultOptionRule: OptionCountRule
}

const NO_TOPIC = 'none'

function ActiveToggle({
  table,
  id,
  isActive,
  onDone,
}: {
  table: 'subjects' | 'topics' | 'question_types'
  id: string
  isActive: boolean
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleTaxonomyActiveAction(table, id, !isActive)
          if (result.success) {
            toast.success(result.message ?? 'Updated.')
            onDone()
          } else {
            toast.error(result.message ?? 'Something went wrong.')
          }
        })
      }
    >
      {isActive ? 'Disable' : 'Enable'}
    </Button>
  )
}

export function TaxonomyManager({
  subjects,
  topics,
  questionTypes,
  optionRules,
  defaultOptionRule,
}: TaxonomyManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [refreshKey, setRefreshKey] = useState(0)

  // Local form state
  const [subjectName, setSubjectName] = useState('')
  const [topicName, setTopicName] = useState('')
  const [topicSubjectId, setTopicSubjectId] = useState(subjects[0]?.id ?? '')
  const [typeName, setTypeName] = useState('')
  const [typeSubjectId, setTypeSubjectId] = useState(subjects[0]?.id ?? '')
  const [typeTopicId, setTypeTopicId] = useState(NO_TOPIC)

  const refresh = () => setRefreshKey((key) => key + 1)

  const subjectName_ = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )
  const subjectItems = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )
  const typeTopicItems = useMemo(
    () => ({
      [NO_TOPIC]: 'Subject-wide (no topic)',
      ...Object.fromEntries(
        topics.filter((topic) => topic.subject_id === typeSubjectId).map((topic) => [topic.id, topic.name])
      ),
    }),
    [topics, typeSubjectId]
  )

  function submit(action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onOk: () => void) {
    startTransition(async () => {
      const result = await action(formData)
      if (result.success) {
        toast.success(result.message ?? 'Created.')
        onOk()
        refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <Tabs defaultValue="subjects" key={refreshKey}>
      <TabsList>
        <TabsTrigger value="subjects">Subjects ({subjects.length})</TabsTrigger>
        <TabsTrigger value="topics">Topics ({topics.length})</TabsTrigger>
        <TabsTrigger value="types">Question types ({questionTypes.length})</TabsTrigger>
        <TabsTrigger value="rules">Option rules</TabsTrigger>
      </TabsList>

      {/* -- Subjects ------------------------------------------------------ */}
      <TabsContent value="subjects" className="pt-5">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Subjects</CardTitle>
            <CardDescription>Top-level areas such as Mathematical Reasoning or Thinking Skills.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="subject-name">New subject</Label>
                <Input
                  id="subject-name"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder="e.g. Reading"
                  className="w-64"
                />
              </div>
              <Button
                type="button"
                disabled={isPending || !subjectName.trim()}
                onClick={() => {
                  const formData = new FormData()
                  formData.set('name', subjectName)
                  submit(createSubjectAction, formData, () => setSubjectName(''))
                }}
              >
                <PlusIcon className="size-4" />
                Add subject
              </Button>
            </div>
            <TaxonomyTable
              rows={subjects.map((subject) => ({
                id: subject.id,
                primary: subject.name,
                secondary: subject.slug,
                isActive: subject.is_active,
              }))}
              table="subjects"
              onDone={refresh}
              emptyLabel="No subjects yet."
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* -- Topics -------------------------------------------------------- */}
      <TabsContent value="topics" className="pt-5">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Topics</CardTitle>
            <CardDescription>Topics live under a subject and group related question types.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={topicSubjectId} onValueChange={setTopicSubjectId} items={subjectItems}>
                  <SelectTrigger className="w-56">
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
              <div className="space-y-1.5">
                <Label htmlFor="topic-name">New topic</Label>
                <Input
                  id="topic-name"
                  value={topicName}
                  onChange={(event) => setTopicName(event.target.value)}
                  placeholder="e.g. Percentages"
                  className="w-64"
                />
              </div>
              <Button
                type="button"
                disabled={isPending || !topicName.trim() || !topicSubjectId}
                onClick={() => {
                  const formData = new FormData()
                  formData.set('subjectId', topicSubjectId)
                  formData.set('name', topicName)
                  submit(createTopicAction, formData, () => setTopicName(''))
                }}
              >
                <PlusIcon className="size-4" />
                Add topic
              </Button>
            </div>
            <TaxonomyTable
              rows={topics.map((topic) => ({
                id: topic.id,
                primary: topic.name,
                secondary: subjectName_.get(topic.subject_id) ?? '—',
                isActive: topic.is_active,
              }))}
              table="topics"
              secondaryLabel="Subject"
              onDone={refresh}
              emptyLabel="No topics yet."
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* -- Question types ----------------------------------------------- */}
      <TabsContent value="types" className="pt-5">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Question types</CardTitle>
            <CardDescription>
              Fine-grained tags like “Percentage of a quantity”. Optional per topic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select
                  value={typeSubjectId}
                  onValueChange={(value) => {
                    setTypeSubjectId(value)
                    setTypeTopicId(NO_TOPIC)
                  }}
                  items={subjectItems}
                >
                  <SelectTrigger className="w-48">
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
              <div className="space-y-1.5">
                <Label>Topic (optional)</Label>
                <Select value={typeTopicId} onValueChange={setTypeTopicId} items={typeTopicItems}>
                  <SelectTrigger className="w-48">
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type-name">New question type</Label>
                <Input
                  id="type-name"
                  value={typeName}
                  onChange={(event) => setTypeName(event.target.value)}
                  placeholder="e.g. Strengthen the argument"
                  className="w-56"
                />
              </div>
              <Button
                type="button"
                disabled={isPending || !typeName.trim() || !typeSubjectId}
                onClick={() => {
                  const formData = new FormData()
                  formData.set('subjectId', typeSubjectId)
                  if (typeTopicId !== NO_TOPIC) {
                    formData.set('topicId', typeTopicId)
                  }
                  formData.set('name', typeName)
                  submit(createQuestionTypeAction, formData, () => setTypeName(''))
                }}
              >
                <PlusIcon className="size-4" />
                Add type
              </Button>
            </div>
            <TaxonomyTable
              rows={questionTypes.map((type) => ({
                id: type.id,
                primary: type.name,
                secondary: subjectName_.get(type.subject_id) ?? '—',
                isActive: type.is_active,
              }))}
              table="question_types"
              secondaryLabel="Subject"
              onDone={refresh}
              emptyLabel="No question types yet."
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* -- Option rules (read-only, code-configured) -------------------- */}
      <TabsContent value="rules" className="pt-5">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Option count rules</CardTitle>
            <CardDescription>
              How many answer options each subject expects. These are configured centrally in{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/lib/questions/option-rules.ts</code>{' '}
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
                      <TableCell className="font-medium text-slate-950">{rule.label}</TableCell>
                      <TableCell>{rule.allowedCounts.join(' or ')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rule.preferredCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium text-slate-950">
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
    </Tabs>
  )
}

interface TaxonomyRow {
  id: string
  primary: string
  secondary: string
  isActive: boolean
}

function TaxonomyTable({
  rows,
  table,
  secondaryLabel = 'Slug',
  onDone,
  emptyLabel,
}: {
  rows: TaxonomyRow[]
  table: 'subjects' | 'topics' | 'question_types'
  secondaryLabel?: string
  onDone: () => void
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>{secondaryLabel}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-slate-950">{row.primary}</TableCell>
              <TableCell className="text-muted-foreground">{row.secondary}</TableCell>
              <TableCell>
                <Badge variant={row.isActive ? 'default' : 'outline'}>{row.isActive ? 'Active' : 'Disabled'}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <ActiveToggle table={table} id={row.id} isActive={row.isActive} onDone={onDone} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
