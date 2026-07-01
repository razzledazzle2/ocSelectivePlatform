import { ClipboardCheckIcon, FileBarChartIcon, LibraryBigIcon, UsersRoundIcon } from 'lucide-react'

import { DashboardCard } from '@/components/dashboard-card'

const cards = [
  {
    label: 'Total students',
    value: '248',
    detail: 'This placeholder slot is ready for real profile-based counts from Supabase.',
    icon: UsersRoundIcon,
  },
  {
    label: 'Question bank',
    value: '0',
    detail: 'Content management begins in Phase 1, but the admin KPI shell is ready now.',
    icon: LibraryBigIcon,
  },
  {
    label: 'Review queue',
    value: '12',
    detail: 'Question QA and moderation workflows can plug into this card later.',
    icon: ClipboardCheckIcon,
  },
  {
    label: 'Reports',
    value: '3',
    detail: 'Analytics will expand later, but the dashboard already reserves the right surface area.',
    icon: FileBarChartIcon,
  },
]

export default function AdminDashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <DashboardCard key={card.label} {...card} />
      ))}
    </div>
  )
}
