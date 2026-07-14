import Link from 'next/link'
import { BookCheckIcon, CalendarClockIcon, FlameIcon, TargetIcon } from 'lucide-react'

import { DashboardEmptyState } from '@/components/student/dashboard-empty-state'
import { FocusAreaCard } from '@/components/student/focus-area-card'
import { RecentActivityList } from '@/components/student/recent-activity-list'
import { TodaysPlanCard } from '@/components/student/todays-plan-card'
import { WeeklyActivityStrip } from '@/components/student/weekly-activity-strip'
import { buttonVariants } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { buildTodaysPlan } from '@/lib/dashboard/analysis'
import { cn } from '@/lib/utils'
import type { AppProfile, StudentDashboardData } from '@/lib/types'

interface StudentDashboardOverviewProps {
  profile: AppProfile
  data: StudentDashboardData
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function StudentDashboardOverview({ profile, data }: StudentDashboardOverviewProps) {
  const { metrics } = data
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  if (!data.hasActivity) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {greeting()}, {firstName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Let&apos;s get your first practice set done.
          </h1>
        </div>
        <DashboardEmptyState />
      </div>
    )
  }

  const todaysPlan = buildTodaysPlan({
    recommendations: data.recommendations,
    revisionDueCount: data.revisionDue.dueCount,
    unfinishedActivity: data.unfinishedActivity,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {greeting()}, {firstName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Here&apos;s your plan</h1>
        </div>
        <Link href="/student/progress" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          View progress
        </Link>
      </div>

      <TodaysPlanCard actions={todaysPlan} />

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
          label="Revision due"
          value={String(metrics.revisionDueToday)}
          hint="Questions ready to review"
          icon={CalendarClockIcon}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <WeeklyActivityStrip days={data.recentDayStrip} />
          <RecentActivityList sessions={data.recentSessions} viewAllHref="/student/progress" />
        </div>
        <FocusAreaCard insights={data.insights} />
      </div>
    </div>
  )
}
