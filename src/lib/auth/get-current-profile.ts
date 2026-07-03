import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

import { normalizeRole } from '@/lib/auth/role-redirect'
import { createClient } from '@/lib/supabase/server'
import type { AppProfile } from '@/lib/types'

type UserMetadata = {
  full_name?: string
  role?: string
}

type ProfileRecord = Partial<AppProfile> & {
  role?: string | null
}

function getUserMetadata(user: User): UserMetadata {
  return (user.user_metadata ?? {}) as UserMetadata
}

function getFallbackName(user: User): string {
  return user.email?.split('@')[0] ?? 'User'
}

export const getCurrentUserProfile = cache(async (): Promise<AppProfile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const profile = data as ProfileRecord | null
  const metadata = getUserMetadata(user)
  const fallbackName = getFallbackName(user)

  if (profile) {
    return {
      id: profile.id ?? user.id,
      role: normalizeRole(profile.role),
      email: profile.email ?? user.email,
      full_name: profile.full_name ?? metadata.full_name ?? fallbackName,
    }
  }

  return {
    id: user.id,
    email: user.email,
    full_name: metadata.full_name ?? fallbackName,
    role: normalizeRole(metadata.role),
  }
})
