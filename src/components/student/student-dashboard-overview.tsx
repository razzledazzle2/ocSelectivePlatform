import Link from 'next/link'
import {
  ArrowRightIcon,
  BookCheckIcon,
  CalendarClockIcon,
  FlameIcon,
  LayersIcon,
  TargetIcon,
  TimerIcon,
} from 'lucide-react'

import { ActivityCalendar } from '@/components/student/activity-calendar'
import { DashboardEmptyState } from '@/components/student/dashboard-empty-state'
import { RecentActivityList } from '@/components/student/recent-activity-list'
import { RecommendedActionCard } from '@/components/student/recommended-action-card'
import { RevisionDueCard } from '@/components/student/revision-due-card'
import { StreakSummaryCard } from '@/components/student/streak-summary-card'
import { WeakAreaCard } from '@/components/student/weak-area-card'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { StatCard } from '@/components/ui/stat-card'
import { cn } from '@/lib/utils'
import type { MockExamSummaryRow } from '@/lib/mock-exams/types'
import type { AppProfile, StudentDashboardData } from '@/lib/types'

interface StudentDashboardOverviewProps {
  profile: AppProfile
  data: StudentDashboardData
  recentMocks?: MockExamSummaryRow[]
}

function MockPerformanceCard({ mocks }: { mocks: MockExamSummaryRow[] }) {
  const submitted = mocks.filter((mock) => mock.status === 'submitted')

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <TimerIcon className="size-4" />
          </span>
          Mock exams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submitted.length > 0 ? (
          <ul className="space-y-2">
            {submitted.map((mock) => (
              <li key={mock.id}>
                <Link
                  href={`/student/mock-exams/${mock.id}/results`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {mock.mockName}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground/80">
                    {mock.accuracy ?? 0}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Rehearse under exam conditions — timed sections, breaks and a full results breakdown.
          </p>
        )}
        <Link
          href="/student/mock-exams"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {submitted.length > 0 ? 'All mock exams' : 'Try a mock exam'}
        </Link>
      </CardContent>
    </Card>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function StudentDashboardOverview({
  profile,
  data,
  recentMocks = [],
}: StudentDashboardOverviewProps) {
  const { metrics } = data
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Welcome hero */}
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 right-24 size-56 rounded-full bg-gold/10"
          />
          <div className="relative max-w-xl space-y-4">
            <p className="text-sm font-medium text-primary-foreground/70">
              {greeting()}, {firstName} 👋
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Small steps today,
              <br />
              stronger tomorrow.
            </h1>
            <p className="text-sm leading-6 text-primary-foreground/70">
              Stay consistent and keep building your edge. You&apos;ve got this!
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/student/practice"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'rounded-xl bg-white px-4 text-primary hover:bg-white/90'
                )}
              >
                Continue learning
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/student/progress"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'lg' }),
                  'rounded-xl border border-white/20 px-4 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground'
                )}
              >
                <LayersIcon className="size-4" />
                My progress
              </Link>
              {metrics.revisionDueToday > 0 ? (
                <Link
                  href="/student/revision"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'lg' }),
                    'rounded-xl border border-white/20 px-4 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground'
                  )}
                >
                  Review {metrics.revisionDueToday} due
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Progress snapshot */}
        <Card className="rounded-3xl shadow-sm ring-border">
          <CardHeader>
            <CardTitle>Your progress</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <ProgressRing value={metrics.overallAccuracy ?? 0} size={116}>
              <span className="text-2xl font-semibold text-foreground">
                {metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
              </span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Accuracy
              </span>
            </ProgressRing>
            <dl className="min-w-0 flex-1 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">This week</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                  {metrics.questionsThisWeek} questions
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Streak</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                  {metrics.currentStreak} day{metrics.currentStreak === 1 ? '' : 's'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Revision due</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                  {metrics.revisionDueToday}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {!data.hasActivity ? (
        <DashboardEmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Questions this week"
              value={String(metrics.questionsThisWeek)}
              hint="Answered in the current week"
              icon={BookCheckIcon}
              tone="brand"
            />
            <StatCard
              label="Overall accuracy"
              value={metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
              hint="Across all saved attempts"
              icon={TargetIcon}
              tone="success"
            />
            <StatCard
              label="Current streak"
              value={`${metrics.currentStreak} day${metrics.currentStreak === 1 ? '' : 's'}`}
              hint="Consecutive active days"
              icon={FlameIcon}
              tone="gold"
            />
            <StatCard
              label="Revision due today"
              value={String(metrics.revisionDueToday)}
              hint="Questions ready to review"
              icon={CalendarClockIcon}
              tone="warning"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <StreakSummaryCard streak={data.streak} />
              <ActivityCalendar calendar={data.calendar} />
              <RecentActivityList sessions={data.recentSessions} />
            </div>
            <div className="space-y-6">
              <RevisionDueCard revisionDue={data.revisionDue} />
              <WeakAreaCard insights={data.insights} />
              <MockPerformanceCard mocks={recentMocks} />
              <RecommendedActionCard recommendations={data.recommendations} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
