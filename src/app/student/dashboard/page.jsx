import { BookCheckIcon, FlameIcon, GraduationCapIcon, TargetIcon } from 'lucide-react'

import { DashboardCard } from '@/components/dashboard-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const cards = [
  {
    label: 'Questions completed',
    value: '128',
    detail: 'Placeholder metric for student activity volume in future practice modules.',
    icon: BookCheckIcon,
  },
  {
    label: 'Accuracy',
    value: '82%',
    detail: 'This card is ready for attempt-tracking data once question mode is introduced.',
    icon: TargetIcon,
  },
  {
    label: 'Revision due',
    value: '14',
    detail: 'Scheduled reviews will plug in here after Smart Revision is enabled.',
    icon: GraduationCapIcon,
  },
  {
    label: 'Current streak',
    value: '6 days',
    detail: 'Streaks are placeholder values now, but the visual slot is ready for Phase 1.',
    icon: FlameIcon,
  },
]

export default function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <Card className="border-white/70 bg-white/90 shadow-lg shadow-slate-200/50">
        <CardHeader>
          <CardTitle>Welcome to the student dashboard</CardTitle>
          <CardDescription>
            This foundation gives students a polished landing space while the question engine and revision
            logic are still being built.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <DashboardCard key={card.label} {...card} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
