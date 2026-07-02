import { createServerClient } from '@supabase/ssr'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/config'

interface UpdateSessionResult {
  response: NextResponse
  supabase: SupabaseClient | null
  user: User | null
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    return { response, supabase, user }
  } catch {
    return { response, supabase: null, user: null }
  }
}
