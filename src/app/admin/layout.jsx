import { ClipboardListIcon, GaugeIcon, UsersIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'

const navigation = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: GaugeIcon },
  { href: '/admin/questions', label: 'Questions', icon: ClipboardListIcon },
  { href: '/admin/students', label: 'Students', icon: UsersIcon },
]

export default async function AdminLayout({ children }) {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })

  return (
    <AppShell
      title="Admin Console"
      description="A clean command layer for content, student management, and operational reporting."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
