export const APP_ROLES = ['student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin']

export const ROLE_REDIRECTS = {
  student: '/student/dashboard',
  admin: '/admin/dashboard',
  tutor: '/tutor/dashboard',
  parent: '/student/dashboard',
  external_customer: '/student/dashboard',
  super_admin: '/admin/dashboard',
}

export const ROLE_ACCESS = {
  student: ['student', 'admin', 'super_admin'],
  admin: ['admin', 'super_admin'],
  tutor: ['tutor', 'admin', 'super_admin'],
}

export function normalizeRole(role) {
  return APP_ROLES.includes(role) ? role : 'student'
}

export function getRoleRedirectPath(role) {
  return ROLE_REDIRECTS[normalizeRole(role)]
}

export function canAccessArea(role, area) {
  return ROLE_ACCESS[area]?.includes(normalizeRole(role)) ?? false
}
