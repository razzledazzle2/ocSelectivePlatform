'use server'

import { redirect } from 'next/navigation'

import { canAccessPath, getRoleRedirectPath, normalizeRole } from '@/lib/auth/access'
import { createClient } from '@/lib/supabase/server'

function createRedirectPath(
  pathname: string,
  messageType: 'error' | 'message',
  message: string
): string {
  const params = new URLSearchParams({
    [messageType]: message,
  })

  return `${pathname}?${params.toString()}`
}

// Supabase auth errors sometimes stringify to an opaque "{}". Prefer a real
// message, then the error code/status, then a readable fallback.
function describeAuthError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const { message, code, status } = error as {
      message?: unknown
      code?: unknown
      status?: unknown
    }

    if (typeof message === 'string') {
      const trimmed = message.trim()
      if (trimmed && trimmed !== '{}') {
        return trimmed
      }
    }

    if (typeof code === 'string' && code.trim()) {
      return `${fallback} (${code.trim()})`
    }

    if (typeof status === 'number') {
      return `${fallback} (status ${status})`
    }
  }

  return fallback
}

export async function signInAction(formData: FormData): Promise<never> {
  const supabase = await createClient()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const nextPath = String(formData.get('next') ?? '').trim()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(createRedirectPath('/login', 'error', describeAuthError(error, 'Unable to sign in.')))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  const role = normalizeRole(profile?.role ?? data.user.user_metadata?.role)

  if (nextPath && nextPath.startsWith('/') && canAccessPath(role, nextPath)) {
    redirect(nextPath)
  }

  redirect(getRoleRedirectPath(role))
}

export async function signUpAction(formData: FormData): Promise<never> {
  const supabase = await createClient()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'student',
      },
    },
  })

  if (error) {
    redirect(createRedirectPath('/signup', 'error', describeAuthError(error, 'Unable to create your account.')))
  }

  if (!data.session) {
    redirect(
      createRedirectPath(
        '/login',
        'message',
        'Account created. If email confirmation is enabled, confirm your email before signing in.'
      )
    )
  }

  redirect('/student/dashboard')
}

export async function signOutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
