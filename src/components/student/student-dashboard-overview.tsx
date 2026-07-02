import Link from 'next/link'
import { BookCheckIcon, CalendarClockIcon, FlameIcon, TargetIcon } from 'lucide-react'

import { ActivityCalendar } from '@/components/student/activity-calendar'
import { DashboardEmptyState } from '@/components/student/dashboard-empty-state'
import { DashboardMetricCard } from '@/components/student/dashboard-metric-card'
import { RecentActivityList } from '@/components/student/recent-activity-list'
import { RecommendedActionCard } from '@/components/student/recommended-action-card'
import { RevisionDueCard } from '@/components/student/revision-due-card'
import { StreakSummaryCard } from '@/components/student/streak-summary-card'
import { WeakAreaCard } from '@/components/student/weak-area-card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppProfile, StudentDashboardData } from '@/lib/types'

interface StudentDashboardOverviewProps {
  profile: AppProfile
  data: StudentDashboardData
}

export function StudentDashboardOverview({ profile, data }: StudentDashboardOverviewProps) {
  const { metrics } = data

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome back, {profile.full_name?.split(' ')[0] || 'student'}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A clear view of your progress: what you have practised, where you are improving, and what to study
            next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
            Start practice
          </Link>
          <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
            Revision
          </Link>
        </div>
      </div>

      {!data.hasActivity ? (
        <DashboardEmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              label="Questions this week"
              value={String(metrics.questionsThisWeek)}
              hint="Answered in the current week"
              icon={BookCheckIcon}
            />
            <DashboardMetricCard
              label="Overall accuracy"
              value={metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
              hint="Across all saved attempts"
              icon={TargetIcon}
            />
            <DashboardMetricCard
              label="Current streak"
              value={`${metrics.currentStreak} day${metrics.currentStreak === 1 ? '' : 's'}`}
              hint="Consecutive active days"
              icon={FlameIcon}
            />
            <DashboardMetricCard
              label="Revision due today"
              value={String(metrics.revisionDueToday)}
              hint="Questions ready to review"
              icon={CalendarClockIcon}
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
              <RecommendedActionCard recommendations={data.recommendations} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
