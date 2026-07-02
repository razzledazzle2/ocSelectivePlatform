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
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function RecentActivityList({ sessions }: RecentActivityListProps) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Your latest practice sessions.</CardDescription>
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
