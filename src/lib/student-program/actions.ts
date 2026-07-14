'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { requireProfile } from '@/lib/auth/require-profile'
import { createClient } from '@/lib/supabase/server'
import { STUDENT_PORTAL_ROLES, type ActionResult, type ExamType } from '@/lib/types'
import {
  ACTIVE_PROGRAM_COOKIE,
  ACTIVE_PROGRAM_COOKIE_MAX_AGE,
  isExamType,
} from '@/lib/student-program/program'

/**
 * Switch the student's active program. Persists to the profile when the column
 * exists (authoritative), and always mirrors to a server-readable cookie so the
 * choice survives before the migration is pushed. Never merges OC/Selective
 * progress — this only changes which bank/stats are shown, not any stored data.
 */
export async function setActiveProgramAction(program: string): Promise<ActionResult<{ program: ExamType }>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!isExamType(program)) {
    return { success: false, message: 'Choose OC or Selective.' }
  }

  const store = await cookies()
  store.set(ACTIVE_PROGRAM_COOKIE, program, {
    maxAge: ACTIVE_PROGRAM_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  // Best-effort account persistence: ignore "column does not exist" (pre-migration).
  try {
    const supabase = await createClient()
    await supabase.from('profiles').update({ active_program: program }).eq('id', profile.id)
  } catch {
    // Cookie already holds the choice; upgrade silently once the migration lands.
  }

  // Availability, recommendations and stats all depend on the program, so refresh
  // the whole student area.
  revalidatePath('/student', 'layout')

  return { success: true, data: { program } }
}
