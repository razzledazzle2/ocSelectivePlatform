import { redirect } from 'next/navigation'

import { getCurrentUserProfile } from '@/lib/auth/get-current-profile'
import { getRoleRedirectPath, normalizeRole } from '@/lib/auth/role-redirect'

export async function requireProfile(options = {}) {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const normalizedRole = normalizeRole(profile.role)

  if (options.allowedRoles?.length && !options.allowedRoles.includes(normalizedRole)) {
    redirect(getRoleRedirectPath(normalizedRole))
  }

  return {
    ...profile,
    role: normalizedRole,
  }
}
