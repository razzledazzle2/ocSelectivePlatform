import { cache } from 'react'

import { normalizeRole } from '@/lib/auth/role-redirect'
import { createClient } from '@/lib/supabase/server'

export const getCurrentUserProfile = cache(async () => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    return {
      ...profile,
      role: normalizeRole(profile.role),
      email: profile.email ?? user.email,
      full_name: profile.full_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
    }
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
    role: normalizeRole(user.user_metadata?.role),
    year_level: user.user_metadata?.year_level ?? null,
    target_exam: user.user_metadata?.target_exam ?? null,
    school: null,
    avatar_url: null,
    is_active: true,
  }
})
