import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ActivityCalendar as ActivityCalendarData, ActivityCalendarDay } from '@/lib/types'

interface ActivityCalendarProps {
  calendar: ActivityCalendarData
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function intensityClass(day: ActivityCalendarDay): string {
  if (!day.active) {
    return day.count > 0 ? 'bg-muted text-muted-foreground' : 'bg-muted/60 text-muted-foreground'
  }
  if (day.count >= 10) return 'bg-brand text-brand-foreground'
  if (day.count >= 5) return 'bg-brand/70 text-brand-foreground'
  return 'bg-brand-soft text-brand'
}

export function ActivityCalendar({ calendar }: ActivityCalendarProps) {
  const leadingCells = Array.from({ length: calendar.firstWeekday })

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
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
          <span className="size-3 rounded-sm bg-brand-soft" />
          <span className="size-3 rounded-sm bg-brand/70" />
          <span className="size-3 rounded-sm bg-brand" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
