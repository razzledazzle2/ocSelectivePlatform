'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  LayersIcon,
  PlayIcon,
} from 'lucide-react'

import { startCuratedMockAction } from '@/app/student/mock-exams/actions'
import { formatTimeLimit } from '@/components/student/mock-exams/utils'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MOCK_TYPE_LABELS, type StudentMockListItem } from '@/lib/mock-tests/types'
import { cn } from '@/lib/utils'

interface CuratedMockListProps {
  mocks: StudentMockListItem[]
}

type TabKey = 'available' | 'in_progress' | 'completed'

function matchesTab(mock: StudentMockListItem, tab: TabKey): boolean {
  if (tab === 'available') {
    return mock.attemptStatus === 'not_started'
  }
  if (tab === 'in_progress') {
    return mock.attemptStatus === 'in_progress'
  }
  return mock.attemptStatus === 'completed'
}

export function CuratedMockList({ mocks }: CuratedMockListProps) {
  const [tab, setTab] = useState<TabKey>('available')

  const counts = useMemo(
    () => ({
      available: mocks.filter((mock) => matchesTab(mock, 'available')).length,
      in_progress: mocks.filter((mock) => matchesTab(mock, 'in_progress')).length,
      completed: mocks.filter((mock) => matchesTab(mock, 'completed')).length,
    }),
    [mocks]
  )

  const visible = mocks.filter((mock) => matchesTab(mock, tab))

  if (mocks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <ClipboardListIcon className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">No mock tests yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Your tutors haven&apos;t published any mock tests yet. When they do, full-length practice
          papers will appear here.
        </p>
      </div>
    )
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
      <TabsList>
        <TabsTrigger value="available">Available ({counts.available})</TabsTrigger>
        <TabsTrigger value="in_progress">In progress ({counts.in_progress})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
      </TabsList>

      {(['available', 'in_progress', 'completed'] as const).map((key) => (
        <TabsContent key={key} value={key} className="pt-4">
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              {key === 'available'
                ? 'No new mock tests to start right now.'
                : key === 'in_progress'
                  ? 'You have no mock tests in progress.'
                  : 'You haven’t completed any mock tests yet.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((mock) => (
                <li key={mock.id}>
                  <MockRow mock={mock} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function MockRow({ mock }: { mock: StudentMockListItem }) {
  const router = useRouter()
  const [isStarting, startStarting] = useTransition()

  function start() {
    startStarting(async () => {
      const result = await startCuratedMockAction(mock.id)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start this mock test.')
        return
      }
      router.push(`/student/mock-exams/${result.data.sessionId}`)
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{mock.title}</h3>
          <Badge variant="secondary">{MOCK_TYPE_LABELS[mock.mockType]}</Badge>
          {mock.difficultyLabel ? <Badge variant="outline">{mock.difficultyLabel}</Badge> : null}
          <Badge variant="outline">{mock.examType}</Badge>
          {mock.attemptStatus === 'completed' && mock.score !== null ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2Icon className="size-3" />
              {mock.score}%
            </Badge>
          ) : null}
        </div>

        {mock.description ? (
          <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground">{mock.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            {formatTimeLimit(mock.estimatedDurationSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClipboardListIcon className="size-3.5" />
            {mock.questionCount} question{mock.questionCount === 1 ? '' : 's'}
          </span>
          {mock.subjectMix.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <LayersIcon className="size-3.5" />
              <span className="flex flex-wrap gap-1">
                {mock.subjectMix.map((share) => (
                  <span key={share.subjectName} className="text-muted-foreground">
                    {share.subjectName} · {share.count}
                  </span>
                ))}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {mock.attemptStatus === 'in_progress' && mock.sessionId ? (
          <Link
            href={`/student/mock-exams/${mock.sessionId}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            <PlayIcon className="size-4" />
            Continue
          </Link>
        ) : mock.attemptStatus === 'completed' && mock.sessionId ? (
          <>
            <Button variant="outline" size="sm" disabled={isStarting} onClick={start}>
              {isStarting ? 'Starting…' : 'Retake'}
            </Button>
            <Link
              href={`/student/mock-exams/${mock.sessionId}/results`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              Review
            </Link>
          </>
        ) : (
          <Button size="sm" disabled={isStarting} onClick={start}>
            <PlayIcon className="size-4" />
            {isStarting ? 'Starting…' : 'Start'}
          </Button>
        )}
      </div>
    </div>
  )
}
