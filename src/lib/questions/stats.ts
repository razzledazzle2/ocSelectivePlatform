import { createClient } from '@/lib/supabase/server'
import type { AdminQuestionStats, QuestionOptionLabel } from '@/lib/types'

interface StatsRpcRow {
  question_id: string
  total_attempts: number
  correct_attempts: number
  total_time_seconds: number
  last_attempted_at: string | null
  option_counts: Record<string, number> | null
}

function buildStats(row: {
  totalAttempts: number
  correctAttempts: number
  totalTimeSeconds: number
  lastAttemptedAt: string | null
  optionCounts: Partial<Record<QuestionOptionLabel, number>>
}): AdminQuestionStats {
  const { totalAttempts, correctAttempts } = row
  return {
    totalAttempts,
    correctAttempts,
    incorrectAttempts: totalAttempts - correctAttempts,
    accuracy: totalAttempts > 0 ? correctAttempts / totalAttempts : null,
    averageTimeSeconds: totalAttempts > 0 ? row.totalTimeSeconds / totalAttempts : null,
    lastAttemptedAt: row.lastAttemptedAt,
    optionCounts: row.optionCounts,
    reportCount: 0,
  }
}

/**
 * Fallback used before the get_admin_question_stats migration is pushed:
 * staff RLS already allows reading question_attempts directly, so aggregate
 * a minimal column set in app code. With ids it stays small (one page of
 * questions); without ids it pulls one slim row per attempt bank-wide.
 */
async function getStatsFromRawAttempts(questionIds: string[] | null): Promise<Map<string, AdminQuestionStats>> {
  const supabase = await createClient()
  let query = supabase
    .from('question_attempts')
    .select('question_id, selected_option_label, is_correct, time_taken_seconds, attempted_at')

  if (questionIds) {
    query = query.in('question_id', questionIds)
  }

  const { data, error } = await query

  if (error) {
    // Stats are supplementary; degrade to "no data" rather than break the bank.
    return new Map()
  }

  const grouped = new Map<
    string,
    { totalAttempts: number; correctAttempts: number; totalTimeSeconds: number; lastAttemptedAt: string | null; optionCounts: Partial<Record<QuestionOptionLabel, number>> }
  >()

  for (const row of (data ?? []) as Array<{
    question_id: string
    selected_option_label: QuestionOptionLabel
    is_correct: boolean
    time_taken_seconds: number | null
    attempted_at: string
  }>) {
    const entry = grouped.get(row.question_id) ?? {
      totalAttempts: 0,
      correctAttempts: 0,
      totalTimeSeconds: 0,
      lastAttemptedAt: null as string | null,
      optionCounts: {} as Partial<Record<QuestionOptionLabel, number>>,
    }
    entry.totalAttempts += 1
    entry.totalTimeSeconds += row.time_taken_seconds ?? 0
    if (row.is_correct) {
      entry.correctAttempts += 1
    }
    entry.optionCounts[row.selected_option_label] = (entry.optionCounts[row.selected_option_label] ?? 0) + 1
    if (!entry.lastAttemptedAt || row.attempted_at > entry.lastAttemptedAt) {
      entry.lastAttemptedAt = row.attempted_at
    }
    grouped.set(row.question_id, entry)
  }

  const stats = new Map<string, AdminQuestionStats>()
  for (const [questionId, entry] of grouped) {
    stats.set(questionId, buildStats(entry))
  }
  return stats
}

/**
 * Per-question attempt aggregates for the admin bank. Prefers the
 * get_admin_question_stats Postgres aggregate (no raw rows leave the DB) and
 * falls back to app-side aggregation while that migration is pending.
 * Pass null to get a summary for every attempted question (stat sorting);
 * pass the visible page's ids for everything else. Questions with zero
 * attempts have no entry in the returned map.
 */
export async function getAdminQuestionStats(questionIds: string[] | null): Promise<Map<string, AdminQuestionStats>> {
  if (questionIds && questionIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_question_stats', {
    p_question_ids: questionIds,
  })

  if (error) {
    return getStatsFromRawAttempts(questionIds)
  }

  const stats = new Map<string, AdminQuestionStats>()
  for (const row of (data ?? []) as StatsRpcRow[]) {
    stats.set(
      row.question_id,
      buildStats({
        totalAttempts: Number(row.total_attempts),
        correctAttempts: Number(row.correct_attempts),
        totalTimeSeconds: Number(row.total_time_seconds),
        lastAttemptedAt: row.last_attempted_at,
        optionCounts: (row.option_counts ?? {}) as Partial<Record<QuestionOptionLabel, number>>,
      })
    )
  }
  return stats
}

/** Total report counts (any status) for a set of questions. */
export async function getQuestionReportCounts(questionIds: string[]): Promise<Map<string, number>> {
  if (questionIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_reports')
    .select('question_id')
    .in('question_id', questionIds)

  if (error) {
    // Report counts are supplementary — never let them take the bank down.
    return new Map()
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ question_id: string }>) {
    counts.set(row.question_id, (counts.get(row.question_id) ?? 0) + 1)
  }
  return counts
}

/**
 * Stats for the questions on the current page, with report counts merged in.
 * Questions without attempts get a zeroed stats object (rendered as
 * "No attempts yet"), so the UI can always distinguish "no data" from
 * "not loaded".
 */
export async function getAdminQuestionStatsForPage(questionIds: string[]): Promise<Map<string, AdminQuestionStats>> {
  const [attemptStats, reportCounts] = await Promise.all([
    getAdminQuestionStats(questionIds),
    getQuestionReportCounts(questionIds),
  ])

  const stats = new Map<string, AdminQuestionStats>()
  for (const questionId of questionIds) {
    const base =
      attemptStats.get(questionId) ??
      buildStats({ totalAttempts: 0, correctAttempts: 0, totalTimeSeconds: 0, lastAttemptedAt: null, optionCounts: {} })
    stats.set(questionId, { ...base, reportCount: reportCounts.get(questionId) ?? 0 })
  }
  return stats
}
