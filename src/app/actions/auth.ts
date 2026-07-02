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
    redirect(createRedirectPath('/login', 'error', error.message))
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
  const targetExam = String(formData.get('target_exam') ?? '').trim()
  const yearLevelValue = String(formData.get('year_level') ?? '').trim()
  const yearLevel = yearLevelValue ? Number(yearLevelValue) : null

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        target_exam: targetExam || null,
        year_level: Number.isNaN(yearLevel) ? null : yearLevel,
        role: 'student',
      },
    },
  })

  if (error) {
    redirect(createRedirectPath('/signup', 'error', error.message))
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
