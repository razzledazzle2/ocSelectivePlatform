import type { ReactNode } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import { ADMIN_PORTAL_ROLES, type NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/admin/questions', label: 'Question Bank', icon: 'clipboard-list' },
  { href: '/admin/coverage', label: 'Coverage', icon: 'chart' },
  { href: '/admin/mocks', label: 'Mock Tests', icon: 'timer' },
  { href: '/admin/import', label: 'Imports', icon: 'upload' },
  { href: '/admin/taxonomy', label: 'Taxonomy', icon: 'layers' },
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
      description="Manage content, monitor students, and grow the question bank."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
