import {
  ADMIN_PORTAL_ROLES,
  APP_ROLES,
  STUDENT_PORTAL_ROLES,
  type AdminPortalRole,
  type AppRole,
  type StudentPortalRole,
} from '@/lib/types'

export const AUTH_PAGES = ['/login', '/signup']
export const PROTECTED_PREFIXES = ['/student', '/admin', '/tutor']

export function normalizeRole(role: string | null | undefined): AppRole {
  return APP_ROLES.includes((role ?? '') as AppRole) ? ((role ?? 'student') as AppRole) : 'student'
}

export function getRoleRedirectPath(role: string | null | undefined): string {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole === 'tutor') {
    return '/admin/dashboard'
  }

  return '/student/dashboard'
}

export function isAdminPortalRole(role: string | null | undefined): role is AdminPortalRole {
  return ADMIN_PORTAL_ROLES.includes(normalizeRole(role) as AdminPortalRole)
}

export function isStudentPortalRole(role: string | null | undefined): role is StudentPortalRole {
  return STUDENT_PORTAL_ROLES.includes(normalizeRole(role) as StudentPortalRole)
}

export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const normalizedRole = normalizeRole(role)

  if (pathname.startsWith('/admin') || pathname.startsWith('/tutor')) {
    return ADMIN_PORTAL_ROLES.includes(normalizedRole as AdminPortalRole)
  }

  if (pathname.startsWith('/student')) {
    return STUDENT_PORTAL_ROLES.includes(normalizedRole as StudentPortalRole)
  }

  return true
}
