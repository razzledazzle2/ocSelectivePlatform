'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { getMockProgramCoverageAction } from '@/app/admin/mocks/actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MOCK_TYPE_LABELS,
  MOCK_TYPES,
  type CoverageBucket,
  type MockProgramCoverage,
} from '@/lib/mock-tests/types'
import { EXAM_TYPES } from '@/lib/types'

const ALL = '__all__'

function BadgeRow({ buckets, empty }: { buckets: CoverageBucket[]; empty: string }) {
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {buckets.map((bucket) => (
        <Badge key={bucket.key} variant="secondary">
          {bucket.label} · {bucket.count}
        </Badge>
      ))}
    </div>
  )
}

export function MockProgramCoveragePanel({ initial }: { initial: MockProgramCoverage }) {
  const [coverage, setCoverage] = useState(initial)
  const [examType, setExamType] = useState(ALL)
  const [mockType, setMockType] = useState(ALL)
  const [isPending, startTransition] = useTransition()

  function applyFilters(nextExamType: string, nextMockType: string) {
    setExamType(nextExamType)
    setMockType(nextMockType)
    startTransition(async () => {
      const result = await getMockProgramCoverageAction({
        examType: nextExamType === ALL ? undefined : nextExamType,
        mockType: nextMockType === ALL ? undefined : nextMockType,
      })
      if (result.success && result.data) {
        setCoverage(result.data)
      } else {
        toast.error(result.message ?? 'Unable to load program coverage.')
      }
    })
  }

  const examItems = { [ALL]: 'All exam types', ...Object.fromEntries(EXAM_TYPES.map((value) => [value, value])) }
  const mockTypeItems = {
    [ALL]: 'All mock types',
    ...Object.fromEntries(MOCK_TYPES.map((value) => [value, MOCK_TYPE_LABELS[value]])),
  }

  const mockTypeBuckets = coverage.byMockType.map((bucket) => ({
    ...bucket,
    label: MOCK_TYPE_LABELS[bucket.key as keyof typeof MOCK_TYPE_LABELS] ?? bucket.label,
  }))

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Program coverage</CardTitle>
            <CardDescription>What your published mocks cover across the whole question bank.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={examType} onValueChange={(value) => applyFilters(value, mockType)} items={examItems}>
              <SelectTrigger className="h-9 w-40" aria-label="Exam type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(examItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mockType} onValueChange={(value) => applyFilters(examType, value)} items={mockTypeItems}>
              <SelectTrigger className="h-9 w-44" aria-label="Mock type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(mockTypeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`space-y-6 pt-5 ${isPending ? 'opacity-60' : ''}`}>
        {coverage.publishedMockCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published mocks match these filters yet. Publish a mock to build program coverage.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Published mocks', value: coverage.publishedMockCount },
                { label: 'Question slots used', value: coverage.totalQuestionSlots },
                { label: 'Distinct questions', value: coverage.distinctQuestionsUsed },
              ].map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{tile.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By subject</p>
                <BadgeRow buckets={coverage.bySubject} empty="No questions yet." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By difficulty</p>
                <BadgeRow buckets={coverage.byDifficulty} empty="No questions yet." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By mock type</p>
                <BadgeRow buckets={mockTypeBuckets} empty="No mocks yet." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Most-used topics
                </p>
                {coverage.topicUsage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No topics used yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {coverage.topicUsage.slice(0, 6).map((topic) => (
                      <li key={topic.topicId} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-foreground">
                          {topic.topicName}
                          <span className="text-muted-foreground"> · {topic.subjectName}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {topic.questionCount} in {topic.mockCount} mock{topic.mockCount === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {coverage.overusedTopics.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-warning">Overused topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {coverage.overusedTopics.map((topic) => (
                    <Badge key={topic.topicId} variant="outline" className="border-warning/40">
                      {topic.topicName} · {topic.mockCount} mocks
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Topics never used ({coverage.neverUsedTopics.length})
              </p>
              {coverage.neverUsedTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every active topic appears in at least one mock. 🎉</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {coverage.neverUsedTopics.slice(0, 40).map((topic) => (
                    <Badge key={topic.topicId} variant="outline">
                      {topic.topicName}
                    </Badge>
                  ))}
                  {coverage.neverUsedTopics.length > 40 ? (
                    <span className="text-xs text-muted-foreground">
                      +{coverage.neverUsedTopics.length - 40} more
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
