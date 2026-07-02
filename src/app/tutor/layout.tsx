import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { requireProfile } from '@/lib/auth/require-profile'
import { getRoleRedirectPath } from '@/lib/auth/role-redirect'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

interface TutorLayoutProps {
  children: ReactNode
}

export default async function TutorLayout({ children }: TutorLayoutProps) {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  redirect(getRoleRedirectPath(profile.role))
}
