import type { ReactNode } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import { ADMIN_PORTAL_ROLES, type NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/admin/questions', label: 'Questions', icon: 'clipboard-list' },
  { href: '/admin/reports', label: 'Reports', icon: 'flag' },
  { href: '/admin/students', label: 'Students', icon: 'users' },
]

interface AdminLayoutProps {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  return (
    <AppShell
      title="Admin Console"
      description="A role-aware workspace for tutors and admins to manage content, monitor students, and grow the question bank."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
