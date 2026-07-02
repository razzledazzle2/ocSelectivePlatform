import { redirect } from 'next/navigation'

import { getCurrentUserProfile } from '@/lib/auth/get-current-profile'
import { getRoleRedirectPath, normalizeRole } from '@/lib/auth/role-redirect'
import type { AppProfile, AppRole } from '@/lib/types'

interface RequireProfileOptions {
  allowedRoles?: AppRole[]
}

export async function requireProfile(options: RequireProfileOptions = {}): Promise<AppProfile> {
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
