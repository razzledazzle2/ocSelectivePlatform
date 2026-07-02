import { NextResponse, type NextRequest } from 'next/server'

import { AUTH_PAGES, canAccessPath, getRoleRedirectPath, PROTECTED_PREFIXES } from '@/lib/auth/access'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!user && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const { data: profile } = supabase
      ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : { data: null }

    return NextResponse.redirect(new URL(getRoleRedirectPath(profile?.role ?? user.user_metadata?.role), request.url))
  }

  if (user && isProtectedRoute) {
    const { data: profile } = supabase
      ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : { data: null }
    const role = profile?.role ?? user.user_metadata?.role

    if (!canAccessPath(role, pathname)) {
      return NextResponse.redirect(new URL(getRoleRedirectPath(role), request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
