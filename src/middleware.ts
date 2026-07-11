import { NextResponse, type NextRequest } from 'next/server'

import { PROTECTED_PREFIXES } from '@/lib/auth/access'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Must live in `src/` — the app router is at `src/app`, so a root-level
 * `middleware.ts` is never registered by Next and silently never runs.
 *
 * Scope is deliberately narrow: refresh the session cookie (the only place that
 * can write it, since Server Components cannot) and bounce anonymous users off
 * protected routes. Role enforcement is not duplicated here — the portal layouts
 * call `requireProfile({ allowedRoles })`, `/login` and `/signup` redirect
 * signed-in users themselves, and RLS guards the data. A `profiles` lookup here
 * would add a database round trip to every request, including every prefetch.
 */
export async function middleware(request: NextRequest) {
  const { response, identity } = await updateSession(request)
  const { pathname } = request.nextUrl
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!identity && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
