import type { AppRole } from '@/lib/types'
import { APP_ROLES } from '@/lib/types'

export const ROLE_REDIRECTS: Record<AppRole, string> = {
  student: '/student/dashboard',
  admin: '/admin/dashboard',
  tutor: '/tutor/dashboard',
  parent: '/student/dashboard',
  external_customer: '/student/dashboard',
  super_admin: '/admin/dashboard',
}

export const ROLE_ACCESS: Record<'student' | 'admin' | 'tutor', AppRole[]> = {
  student: ['student', 'admin', 'super_admin'],
  admin: ['admin', 'super_admin'],
  tutor: ['tutor', 'admin', 'super_admin'],
}

export function normalizeRole(role: string | null | undefined): AppRole {
  return APP_ROLES.includes((role ?? '') as AppRole) ? ((role ?? 'student') as AppRole) : 'student'
}

export function getRoleRedirectPath(role: string | null | undefined): string {
  return ROLE_REDIRECTS[normalizeRole(role)]
}

export function canAccessArea(role: string | null | undefined, area: keyof typeof ROLE_ACCESS): boolean {
  return ROLE_ACCESS[area]?.includes(normalizeRole(role)) ?? false
}
