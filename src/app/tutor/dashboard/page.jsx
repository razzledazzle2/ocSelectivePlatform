import { ActivityIcon, BookOpenTextIcon, CheckSquare2Icon, SirenIcon } from 'lucide-react'

import { DashboardCard } from '@/components/dashboard-card'

const cards = [
  {
    label: 'Active classes',
    value: '4',
    detail: 'Future class group tooling can map directly into this placeholder summary.',
    icon: BookOpenTextIcon,
  },
  {
    label: 'Homework completion',
    value: '76%',
    detail: 'Completion and accountability metrics will connect here in a later phase.',
    icon: CheckSquare2Icon,
  },
  {
    label: 'Students needing attention',
    value: '9',
    detail: 'This space is reserved for intervention logic once learning signals exist.',
    icon: SirenIcon,
  },
  {
    label: 'Recent activity',
    value: '18',
    detail: 'Tutor-facing timelines and notifications can plug into this card next.',
    icon: ActivityIcon,
  },
]

export default function TutorDashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <DashboardCard key={card.label} {...card} />
      ))}
    </div>
  )
}
