import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ActivityCalendar as ActivityCalendarData, ActivityCalendarDay } from '@/lib/types'

interface ActivityCalendarProps {
  calendar: ActivityCalendarData
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function intensityClass(day: ActivityCalendarDay): string {
  if (!day.active) {
    return day.count > 0 ? 'bg-slate-100 text-slate-500' : 'bg-muted/60 text-muted-foreground'
  }
  if (day.count >= 10) return 'bg-emerald-500 text-white'
  if (day.count >= 5) return 'bg-emerald-400 text-white'
  return 'bg-emerald-200 text-emerald-900'
}

export function ActivityCalendar({ calendar }: ActivityCalendarProps) {
  const leadingCells = Array.from({ length: calendar.firstWeekday })

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>{calendar.monthLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index} className="text-[0.65rem] font-medium text-muted-foreground">
              {label}
            </span>
          ))}
          {leadingCells.map((_, index) => (
            <span key={`lead-${index}`} aria-hidden />
          ))}
          {calendar.days.map((day) => {
            const dayNumber = Number(day.date.slice(-2))
            const title = `${day.date}: ${day.count} attempt${day.count === 1 ? '' : 's'}${
              day.active ? ' (active)' : ''
            }`
            return (
              <span
                key={day.date}
                title={title}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md text-[0.7rem] font-medium tabular-nums',
                  intensityClass(day)
                )}
              >
                {dayNumber}
              </span>
            )
          })}
        </div>
        <div className="flex items-center justify-end gap-2 text-[0.65rem] text-muted-foreground">
          <span>Less</span>
          <span className="size-3 rounded-sm bg-muted/60" />
          <span className="size-3 rounded-sm bg-emerald-200" />
          <span className="size-3 rounded-sm bg-emerald-400" />
          <span className="size-3 rounded-sm bg-emerald-500" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
