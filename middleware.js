import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const AUTH_PAGES = ['/login', '/signup']
const PROTECTED_PREFIXES = ['/student', '/admin', '/tutor']

export async function middleware(request) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!user && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
