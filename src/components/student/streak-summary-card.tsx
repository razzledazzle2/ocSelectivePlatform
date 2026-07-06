import { FlameIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { StreakSummary } from '@/lib/types'

interface StreakSummaryCardProps {
  streak: StreakSummary
}

function streakCopy(currentStreak: number): string {
  if (currentStreak === 0) {
    return 'Do a short set today to start a new streak.'
  }
  if (currentStreak === 1) {
    return 'You are on a 1-day streak. Come back tomorrow to keep it going.'
  }
  return `You are on a ${currentStreak}-day streak. Keep going with a short revision set today.`
}

export function StreakSummaryCard({ streak }: StreakSummaryCardProps) {
  const stats = [
    { label: 'Longest streak', value: `${streak.longestStreak} day${streak.longestStreak === 1 ? '' : 's'}` },
    { label: 'Active days this month', value: String(streak.activeDaysThisMonth) },
    { label: 'Questions this week', value: String(streak.questionsThisWeek) },
  ]

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gold-soft text-gold-foreground">
            <FlameIcon className="size-4" />
          </span>
          Your learning streak
        </CardTitle>
        <CardDescription>{streakCopy(streak.currentStreak)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight text-foreground">{streak.currentStreak}</span>
          <span className="text-sm text-muted-foreground">
            day{streak.currentStreak === 1 ? '' : 's'} in a row
          </span>
        </div>
        <Separator />
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="text-sm font-medium text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
