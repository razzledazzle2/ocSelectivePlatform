import type { ReactNode } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { requireProfile } from '@/lib/auth/require-profile'
import { STUDENT_PORTAL_ROLES, type NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/student/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/student/practice', label: 'Practice', icon: 'book-open' },
  { href: '/student/revision', label: 'Revision', icon: 'revision' },
  { href: '/student/mock-exams', label: 'Mocks', icon: 'timer' },
  { href: '/student/progress', label: 'Progress', icon: 'chart' },
]

interface StudentLayoutProps {
  children: ReactNode
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })

  return (
    <AppShell
      title="Student Portal"
      description="Practice, revise, and track your progress."
      navigation={navigation}
      profile={profile}
    >
      {children}
    </AppShell>
  )
}
