import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from '@/lib/supabase/config'

/**
 * Identity established by cryptographically verifying the access token, rather
 * than by asking the Auth server who the caller is.
 */
export interface VerifiedIdentity {
  userId: string
  email?: string
  metadataRole?: string
  metadataFullName?: string
}

type Jwks = { keys: Array<Record<string, unknown>> }

/**
 * `getClaims()` caches the JWKS on the client instance, but we build a fresh
 * server client per request, so that cache never survives. Holding it at module
 * scope keeps verification entirely local: `getClaims()` short-circuits on a
 * supplied JWKS and never touches the network.
 *
 * This caches only the project's *public* signing keys — never a user's session.
 */
const JWKS_TTL_MS = 10 * 60 * 1000

let cachedJwks: Jwks | null = null
let cachedAt = 0
let inflight: Promise<Jwks | null> | null = null

async function loadJwks(): Promise<Jwks | null> {
  if (cachedJwks && Date.now() - cachedAt < JWKS_TTL_MS) {
    return cachedJwks
  }

  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    try {
      const { supabaseUrl } = getSupabaseEnv()
      const response = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)

      if (!response.ok) {
        return null
      }

      const jwks = (await response.json()) as Jwks

      if (!jwks?.keys?.length) {
        return null
      }

      cachedJwks = jwks
      cachedAt = Date.now()
      return cachedJwks
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Verifies the caller's access token and returns its claims.
 *
 * Prefer this over `auth.getUser()`, which sends a request to the Auth server on
 * every single call. With asymmetric signing keys the signature and expiry are
 * checked locally via WebCrypto. If the project ever falls back to a symmetric
 * secret, `getClaims()` transparently degrades to a `getUser()` round trip, so
 * this is always at least as correct as the call it replaces.
 *
 * Expiring sessions are still refreshed: `getClaims()` calls `getSession()`
 * first, which rotates the token and writes the refreshed cookies.
 */
export async function getVerifiedIdentity(
  supabase: SupabaseClient
): Promise<VerifiedIdentity | null> {
  const jwks = await loadJwks()
  const { data, error } = await supabase.auth.getClaims(
    undefined,
    jwks ? { jwks: jwks as never } : undefined
  )

  if (error || !data?.claims?.sub) {
    return null
  }

  const claims = data.claims
  const metadata = (claims.user_metadata ?? {}) as { role?: string; full_name?: string }

  return {
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    metadataRole: metadata.role,
    metadataFullName: metadata.full_name,
  }
}
