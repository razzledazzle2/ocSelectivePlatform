import { BookOpenIcon, GaugeIcon, RotateCcwIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'

const navigation = [
  { href: '/student/dashboard', label: 'Dashboard', icon: GaugeIcon },
  { href: '/student/practice', label: 'Practice', icon: BookOpenIcon },
  { href: '/student/revision', label: 'Revision', icon: RotateCcwIcon },
]

export default async function StudentLayout({ children }) {
  const profile = await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })

  return (
    <AppShell
      title="Student Portal"
      description="A focused home for dashboard metrics, practice, and upcoming revision workflows."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
