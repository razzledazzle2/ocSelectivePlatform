import Link from 'next/link'
import {
  BookCheckIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  TargetIcon,
  TrendingUpIcon,
} from 'lucide-react'

import { DashboardCard } from '@/components/dashboard-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StudentDashboardStats } from '@/lib/types'

interface StudentStatsCardsProps {
  stats: StudentDashboardStats
}

function formatAccuracy(value: number | null): string {
  return value === null ? 'No data yet' : `${value}%`
}

const attemptDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function StudentStatsCards({ stats }: StudentStatsCardsProps) {
  const cards = [
    {
      label: 'Questions completed',
      value: String(stats.questionsCompleted),
      detail: stats.questionsCompleted
        ? 'Every saved attempt now contributes to your running progress.'
        : 'Start a practice session to begin building your history.',
      icon: BookCheckIcon,
    },
    {
      label: 'Correct answers',
      value: String(stats.correctAnswers),
      detail: stats.correctAnswers
        ? 'Correct answers include every saved practice attempt so far.'
        : 'Correct answers will appear once you begin practising.',
      icon: TrendingUpIcon,
    },
    {
      label: 'Incorrect answers',
      value: String(stats.incorrectAnswers),
      detail: stats.incorrectAnswers
        ? 'Incorrect answers automatically flow into your revision queue.'
        : 'Your revision queue is empty until you miss a question.',
      icon: CircleAlertIcon,
    },
    {
      label: 'Overall accuracy',
      value: formatAccuracy(stats.overallAccuracy),
      detail:
        stats.overallAccuracy === null
          ? 'Accuracy will appear after your first saved attempt.'
          : 'Accuracy is calculated across all saved practice attempts.',
      icon: TargetIcon,
    },
  ]

  const revisionCopy =
    stats.revisionDueToday > 0
      ? `You have ${stats.revisionDueToday} question${stats.revisionDueToday === 1 ? '' : 's'} due for revision today.${
          stats.weakestTopic ? ` Your most-missed topic recently is ${stats.weakestTopic}.` : ''
        }`
      : null

  return (
    <div className="space-y-6">
      {revisionCopy ? (
        <Alert>
          <CalendarClockIcon />
          <AlertTitle>Revision due today</AlertTitle>
          <AlertDescription>
            <p>{revisionCopy}</p>
            <Link
              href="/student/revision"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'mt-3')}
            >
              Go to revision
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <DashboardCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent practice sessions</CardTitle>
            <CardDescription>Your latest saved sessions and their outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {stats.recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No practice sessions have been completed yet.
              </p>
            ) : (
              stats.recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {session.examType ? <Badge variant="outline">{session.examType}</Badge> : null}
                    {session.subjectName ? <Badge variant="secondary">{session.subjectName}</Badge> : null}
                    {session.topicName ? <Badge variant="outline">{session.topicName}</Badge> : null}
                    {session.difficulty ? <Badge variant="outline">Difficulty {session.difficulty}</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-6 text-sm text-slate-700">
                    <p>{session.totalQuestions} questions</p>
                    <p>{session.correctCount} correct</p>
                    <p>{session.incorrectCount} incorrect</p>
                    <p>{session.accuracy ?? 0}% accuracy</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Weakest area</CardTitle>
              <CardDescription>
                Based on incorrect attempts, when enough data exists.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-slate-700">
              <p>
                Subject:{' '}
                <span className="font-semibold text-slate-950">
                  {stats.weakestSubject ?? 'Not enough data yet'}
                </span>
              </p>
              <p>
                Topic:{' '}
                <span className="font-semibold text-slate-950">
                  {stats.weakestTopic ?? 'Not enough data yet'}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Recent mistakes</CardTitle>
              <CardDescription>
                Quick access to the questions you should revisit next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {stats.recentMistakes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mistakes are being tracked yet.
                </p>
              ) : (
                stats.recentMistakes.map((mistake) => (
                  <div
                    key={mistake.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {mistake.subjectName ? <Badge variant="secondary">{mistake.subjectName}</Badge> : null}
                      {mistake.topicName ? <Badge variant="outline">{mistake.topicName}</Badge> : null}
                      <Badge variant="destructive">Missed {mistake.timesIncorrect}x</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{mistake.questionText}</p>
                    <Link
                      href={`/student/revision/${mistake.questionId}`}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-3')}
                    >
                      Review question
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Recent attempts</CardTitle>
          <CardDescription>Your latest saved answers across practice and revision.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {stats.recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attempts saved yet. Start a practice session to begin your history.
            </p>
          ) : (
            stats.recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{attempt.questionText}</p>
                  <p className="text-xs text-muted-foreground">
                    {attempt.subjectName ?? 'Subject'}
                    {attempt.topicName ? ` • ${attempt.topicName}` : ''} •{' '}
                    {attemptDateFormatter.format(new Date(attempt.attemptedAt))}
                  </p>
                </div>
                <Badge variant={attempt.isCorrect ? 'default' : 'destructive'}>
                  {attempt.isCorrect ? 'Correct' : 'Incorrect'}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
