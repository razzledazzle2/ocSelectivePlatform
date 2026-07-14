import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ActivityCalendarDay } from '@/lib/types'

interface WeeklyActivityStripProps {
  days: ActivityCalendarDay[]
}

const dayLabelFormatter = new Intl.DateTimeFormat('en-AU', { weekday: 'short' })

function intensityClass(day: ActivityCalendarDay): string {
  if (!day.active) {
    return day.count > 0 ? 'bg-muted text-muted-foreground' : 'bg-muted/60 text-muted-foreground'
  }
  if (day.count >= 10) return 'bg-brand text-brand-foreground'
  if (day.count >= 5) return 'bg-brand/70 text-brand-foreground'
  return 'bg-brand-soft text-brand'
}

/**
 * A compact trailing-14-day glance for the Dashboard — a smaller sibling of
 * the full monthly `ActivityCalendar`, which stays on the Progress page.
 */
export function WeeklyActivityStrip({ days }: WeeklyActivityStripProps) {
  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <CardTitle>Last 14 days</CardTitle>
        <CardDescription>A quick glance at your recent consistency.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5">
          {days.map((day) => {
            const dayNumber = Number(day.date.slice(-2))
            const weekday = dayLabelFormatter.format(new Date(`${day.date}T00:00:00`))
            const title = `${day.date}: ${day.count} attempt${day.count === 1 ? '' : 's'}${
              day.active ? ' (active)' : ''
            }`
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span
                  title={title}
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-md text-[0.7rem] font-medium tabular-nums',
                    intensityClass(day)
                  )}
                >
                  {dayNumber}
                </span>
                <span className="text-[0.6rem] text-muted-foreground">{weekday[0]}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
