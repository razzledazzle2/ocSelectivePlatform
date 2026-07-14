'use server'

import { requireProfile } from '@/lib/auth/require-profile'
import { getRecentPracticeSessionsPage } from '@/lib/practice/queries'
import { STUDENT_PORTAL_ROLES, type ActionResult, type RecentPracticeSessionsPage } from '@/lib/types'

export async function loadMoreProgressHistoryAction(page: number): Promise<ActionResult<RecentPracticeSessionsPage>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  try {
    const result = await getRecentPracticeSessionsPage(profile.id, { page, limit: 15 })
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load more activity right now.',
    }
  }
}
