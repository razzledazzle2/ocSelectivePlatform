/**
 * Active learning program (OC vs Selective) resolution.
 *
 * The program decides which question bank a student practises against and which
 * availability/recommendation figures they see. It is resolved server-side so
 * React Server Components can filter by it before rendering.
 *
 * Store precedence (most to least authoritative):
 *   1. profiles.active_program  — the account-level preference (migration
 *      20260711140359). Read defensively: pre-migration the column is absent and
 *      the guarded select simply yields nothing.
 *   2. active_program cookie     — a server-readable local fallback that keeps the
 *      selector working before the migration is pushed, and for signed-out edges.
 *   3. DEFAULT_PROGRAM ('OC')    — a sensible default so practice always has a bank.
 */
import { cache } from 'react'
import { cookies } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { EXAM_TYPES, type ExamType } from '@/lib/types'

export const ACTIVE_PROGRAM_COOKIE = 'active_program'
export const DEFAULT_PROGRAM: ExamType = 'OC'

/** Cookie lifetime: a year — this is a durable preference, not a session flag. */
export const ACTIVE_PROGRAM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isExamType(value: string | null | undefined): value is ExamType {
  return !!value && (EXAM_TYPES as readonly string[]).includes(value)
}

/**
 * Programs a student may switch between. There is no per-student program access
 * model yet, so every student can access both — callers use this to decide
 * whether to render a switcher or just a static label.
 */
export function getAvailablePrograms(): ExamType[] {
  return [...EXAM_TYPES]
}

/** Best-effort read of the account-level preference; null pre-migration or on error. */
async function readProfileProgram(profileId: string): Promise<ExamType | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('active_program')
      .eq('id', profileId)
      .maybeSingle<{ active_program: string | null }>()

    if (error || !data) {
      return null
    }
    return isExamType(data.active_program) ? data.active_program : null
  } catch {
    // Column absent (pre-migration) or transient failure — fall through to cookie.
    return null
  }
}

/**
 * The student's active program. Profile preference wins; otherwise the cookie;
 * otherwise the default. Never throws. `cache`d so the layout and page share one
 * resolution per request.
 */
export const getActiveProgram = cache(async (profileId: string): Promise<ExamType> => {
  const profileProgram = await readProfileProgram(profileId)
  if (profileProgram) {
    return profileProgram
  }

  const store = await cookies()
  const cookieValue = store.get(ACTIVE_PROGRAM_COOKIE)?.value
  return isExamType(cookieValue) ? cookieValue : DEFAULT_PROGRAM
})
