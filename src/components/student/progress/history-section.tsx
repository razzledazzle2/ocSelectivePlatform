'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { loadMoreProgressHistoryAction } from '@/app/student/progress/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RecentPracticeSessionsPage } from '@/lib/types'
import { HistoryIcon } from 'lucide-react'

interface HistorySectionProps {
  initialPage: RecentPracticeSessionsPage
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function HistorySection({ initialPage }: HistorySectionProps) {
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(0)
  const [data, setData] = useState(initialPage)

  function loadMore() {
    startTransition(async () => {
      const result = await loadMoreProgressHistoryAction(page + 1)
      if (result.success && result.data) {
        setPage((value) => value + 1)
        setData((prev) => ({
          sessions: [...prev.sessions, ...result.data!.sessions],
          total: result.data!.total,
          hasMore: result.data!.hasMore,
        }))
      } else {
        toast.error(result.message ?? 'Unable to load more activity right now.')
      }
    })
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <CardTitle>Full activity history</CardTitle>
        <CardDescription>Every practice session you have completed.</CardDescription>
      </CardHeader>
      <CardContent className={data.sessions.length === 0 ? '' : 'p-0'}>
        {data.sessions.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No practice sessions yet"
            description="Your completed sets will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Focus</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessions.map((session) => {
                const focus =
                  [session.subjectName, session.topicName].filter(Boolean).join(' — ') || 'Mixed practice'
                return (
                  <TableRow key={session.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {dateFormatter.format(new Date(session.createdAt))}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{focus}</span>
                      {session.examType ? (
                        <Badge variant="outline" className="ml-2">
                          {session.examType}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{session.totalQuestions}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {session.accuracy === null ? '—' : `${Math.round(session.accuracy)}%`}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {data.hasMore ? (
        <div className="flex justify-center border-t border-border/70 p-4">
          <Button variant="outline" disabled={isPending} loading={isPending} onClick={loadMore}>
            Load more ({data.sessions.length} of {data.total})
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
