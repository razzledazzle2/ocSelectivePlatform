import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { RecentPracticeSession } from '@/lib/types'

interface RecentActivityListProps {
  sessions: RecentPracticeSession[]
  /** When set, shows a "View all activity" link (e.g. to the Progress page). */
  viewAllHref?: string
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function RecentActivityList({ sessions, viewAllHref }: RecentActivityListProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest practice sessions.</CardDescription>
        </div>
        {viewAllHref && sessions.length > 0 ? (
          <Link
            href={viewAllHref}
            className="shrink-0 whitespace-nowrap text-xs font-medium text-brand hover:underline"
          >
            View all activity
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className={sessions.length === 0 ? 'space-y-3' : 'p-0'}>
        {sessions.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              No practice sessions yet. Your completed sets will appear here.
            </p>
            <Link href="/student/practice" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Start practising
            </Link>
          </>
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
              {sessions.map((session) => {
                const focus = [session.subjectName, session.topicName].filter(Boolean).join(' — ') || 'Mixed practice'
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
    </Card>
  )
}
