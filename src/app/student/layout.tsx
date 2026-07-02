import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import type { NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/student/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/student/practice', label: 'Practice', icon: 'book-open' },
  { href: '/student/revision', label: 'Revision', icon: 'revision' },
]

interface StudentLayoutProps {
  children: ReactNode
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
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
