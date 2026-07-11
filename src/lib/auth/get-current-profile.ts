import { cache } from 'react'

import { getVerifiedIdentity, type VerifiedIdentity } from '@/lib/auth/claims'
import { normalizeRole } from '@/lib/auth/role-redirect'
import { createClient } from '@/lib/supabase/server'
import type { AppProfile } from '@/lib/types'

type ProfileRecord = Partial<AppProfile> & {
  role?: string | null
}

function getFallbackName(identity: VerifiedIdentity): string {
  return identity.email?.split('@')[0] ?? 'User'
}

export const getCurrentUserProfile = cache(async (): Promise<AppProfile | null> => {
  const supabase = await createClient()
  const identity = await getVerifiedIdentity(supabase)

  if (!identity) {
    return null
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, role, email, full_name')
    .eq('id', identity.userId)
    .maybeSingle()

  const profile = data as ProfileRecord | null
  const fallbackName = getFallbackName(identity)

  if (profile) {
    return {
      id: profile.id ?? identity.userId,
      role: normalizeRole(profile.role),
      email: profile.email ?? identity.email,
      full_name: profile.full_name ?? identity.metadataFullName ?? fallbackName,
    }
  }

  return {
    id: identity.userId,
    email: identity.email,
    full_name: identity.metadataFullName ?? fallbackName,
    role: normalizeRole(identity.metadataRole),
  }
})
