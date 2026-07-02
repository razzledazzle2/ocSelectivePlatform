import { redirect } from 'next/navigation'

import { getCurrentUserProfile } from '@/lib/auth/get-current-profile'
import { getRoleRedirectPath } from '@/lib/auth/role-redirect'

export default async function HomePage(): Promise<never> {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  redirect(getRoleRedirectPath(profile.role))
}
