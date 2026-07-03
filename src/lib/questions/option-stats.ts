import { createClient } from '@/lib/supabase/server'
import type { OptionStats, QuestionOptionLabel } from '@/lib/types'

/**
 * Aggregated option response distribution for a question, via the
 * get_question_option_stats security-definer function. The function only
 * returns rows once the caller has attempted the question, so this can never
 * leak the answer distribution before a student answers. Returns null on any
 * failure — the distribution is a nice-to-have, never worth failing a save.
 */
export async function getQuestionOptionStats(questionId: string): Promise<OptionStats | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_question_option_stats', {
    p_question_id: questionId,
  })

  if (error || !data) {
    return null
  }

  const counts: Partial<Record<QuestionOptionLabel, number>> = {}
  let totalAttempts = 0

  for (const row of data as Array<{ option_label: string; attempt_count: number | string }>) {
    const count = Number(row.attempt_count)
    if (!Number.isFinite(count)) continue
    counts[row.option_label as QuestionOptionLabel] = count
    totalAttempts += count
  }

  return { totalAttempts, counts }
}
