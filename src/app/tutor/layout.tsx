import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import type { NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [{ href: '/tutor/dashboard', label: 'Dashboard', icon: 'gauge' }]

interface TutorLayoutProps {
  children: ReactNode
}

export default async function TutorLayout({ children }: TutorLayoutProps) {
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
