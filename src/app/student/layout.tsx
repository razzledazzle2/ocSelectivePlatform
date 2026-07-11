import type { ReactNode } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { ProgramSwitcher } from '@/components/student/learn/program-switcher'
import { requireProfile } from '@/lib/auth/require-profile'
import { getActiveProgram, getAvailablePrograms } from '@/lib/student-program/program'
import { STUDENT_PORTAL_ROLES, type NavigationItem } from '@/lib/types'

const navigation: NavigationItem[] = [
  { href: '/student/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/student/practice', label: 'Learn & Practice', icon: 'book-open' },
  { href: '/student/revision', label: 'Revision', icon: 'revision' },
  { href: '/student/mock-exams', label: 'Mock Exams', icon: 'timer' },
  { href: '/student/progress', label: 'Progress', icon: 'chart' },
]

interface StudentLayoutProps {
  children: ReactNode
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const [program, programs] = [await getActiveProgram(profile.id), getAvailablePrograms()]

  return (
    <AppShell
      title="Student Portal"
      description="Practice, revise, and track your progress."
      navigation={navigation}
      profile={profile}
      sidebarAccessory={<ProgramSwitcher current={program} programs={programs} variant="sidebar" />}
      headerAccessory={<ProgramSwitcher current={program} programs={programs} variant="header" />}
    >
      {children}
    </AppShell>
  )
}
