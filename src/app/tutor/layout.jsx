import { GaugeIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'

const navigation = [{ href: '/tutor/dashboard', label: 'Dashboard', icon: GaugeIcon }]

export default async function TutorLayout({ children }) {
  const profile = await requireProfile({
    allowedRoles: ['tutor', 'admin', 'super_admin'],
  })

  return (
    <AppShell
      title="Tutor Workspace"
      description="A simple role-specific workspace for future class operations, monitoring, and support."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
