import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getVerifiedIdentity, type VerifiedIdentity } from '@/lib/auth/claims'
import { getSupabaseEnv } from '@/lib/supabase/config'

interface UpdateSessionResult {
  response: NextResponse
  identity: VerifiedIdentity | null
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request })

  try {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // The response must be rebuilt from the mutated request, otherwise the
          // rotated token never reaches the Server Components downstream and every
          // `createClient()` in the render re-refreshes the same expired session.
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // Verifies the JWT locally (no Auth API round trip) and refreshes the session
    // when it is near expiry, writing the rotated cookies through `setAll` above.
    const identity = await getVerifiedIdentity(supabase)

    return { response, identity }
  } catch {
    return { response, identity: null }
  }
}
