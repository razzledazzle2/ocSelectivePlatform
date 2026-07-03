import Link from 'next/link'
import {
  BookCheckIcon,
  CalendarClockIcon,
  FlameIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { ActivityCalendar } from '@/components/student/activity-calendar'
import { RecentActivityList } from '@/components/student/recent-activity-list'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressRing } from '@/components/ui/progress-ring'
import { StatCard } from '@/components/ui/stat-card'
import { requireProfile } from '@/lib/auth/require-profile'
import { formatAreaLabel } from '@/lib/dashboard/analysis'
import { getStudentDashboardData } from '@/lib/dashboard/queries'
import { STUDENT_PORTAL_ROLES, type AreaInsight } from '@/lib/types'
import { cn } from '@/lib/utils'

function AreaCard({
  heading,
  area,
  tone,
}: {
  heading: string
  area: AreaInsight
  tone: 'strong' | 'weak'
}) {
  const Icon = tone === 'strong' ? TrendingUpIcon : TrendingDownIcon

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              tone === 'strong' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
            )}
          >
            <Icon className="size-4" />
          </span>
          {heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{formatAreaLabel(area)}</p>
          <Badge variant="secondary">{area.accuracy}%</Badge>
        </div>
        {area.questionTypeName ? (
          <p className="text-xs text-muted-foreground">{area.questionTypeName}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {area.correct}/{area.attempts} correct across recent attempts
        </p>
      </CardContent>
    </Card>
  )
}

export default async function StudentProgressPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const data = await getStudentDashboardData(profile.id)
  const { metrics, streak, insights } = data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Progress"
        title="Your learning analytics"
        description="A clear read on how you are tracking: accuracy, consistency, and the areas that deserve your next session."
        actions={
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
            Start focused practice
          </Link>
        }
      />

      {!data.hasActivity ? (
        <EmptyState
          icon={TargetIcon}
          title="No analytics yet"
          description="Complete a few practice sets and this page fills with accuracy trends, strongest and weakest areas, and study consistency."
          action={
            <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
              Start practising
            </Link>
          }
        />
      ) : (
        <>
          {/* Overall hero */}
          <Card className="rounded-3xl shadow-sm ring-border">
            <CardContent className="flex flex-wrap items-center gap-8">
              <ProgressRing value={metrics.overallAccuracy ?? 0} size={132}>
                <span className="text-3xl font-semibold text-foreground">
                  {metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
                </span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Overall accuracy
                </span>
              </ProgressRing>
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Questions this week
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {metrics.questionsThisWeek}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Longest streak
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {streak.longestStreak} day{streak.longestStreak === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active days this month
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {streak.activeDaysThisMonth}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Questions this week"
              value={String(metrics.questionsThisWeek)}
              icon={BookCheckIcon}
              tone="brand"
            />
            <StatCard
              label="Overall accuracy"
              value={metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
              icon={TargetIcon}
              tone="success"
            />
            <StatCard
              label="Current streak"
              value={`${metrics.currentStreak} day${metrics.currentStreak === 1 ? '' : 's'}`}
              icon={FlameIcon}
              tone="gold"
            />
            <StatCard
              label="Revision due"
              value={String(metrics.revisionDueToday)}
              icon={CalendarClockIcon}
              tone="warning"
            />
          </div>

          {/* Strengths & focus */}
          {insights.hasEnoughData && (insights.strongest || insights.weakest) ? (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.strongest ? (
                <AreaCard heading="Strongest area" area={insights.strongest} tone="strong" />
              ) : null}
              {insights.weakest ? (
                <AreaCard heading="Focus area" area={insights.weakest} tone="weak" />
              ) : null}
            </div>
          ) : (
            <Card className="rounded-2xl shadow-sm ring-border">
              <CardHeader>
                <CardTitle>Strengths & focus areas</CardTitle>
                <CardDescription>
                  Keep practising across a few topics and your strongest and weakest areas will appear here.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ActivityCalendar calendar={data.calendar} />
            <RecentActivityList sessions={data.recentSessions} />
          </div>
        </>
      )}
    </div>
  )
}
