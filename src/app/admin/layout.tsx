import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import type { NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/admin/questions', label: 'Questions', icon: 'clipboard-list' },
  { href: '/admin/students', label: 'Students', icon: 'users' },
]

interface AdminLayoutProps {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
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
