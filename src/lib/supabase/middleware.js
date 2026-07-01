import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/config'

export async function updateSession(request) {
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
