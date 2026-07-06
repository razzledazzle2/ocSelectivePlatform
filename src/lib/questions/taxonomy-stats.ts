import { createClient } from '@/lib/supabase/server'
import type { QuestionStatus } from '@/lib/types'

export interface TaxonomyStatusBreakdown {
  total: number
  published: number
  draft: number
  archived: number
}

/**
 * How the existing question bank actually uses the taxonomy. Keyed by row id
 * (or tag text), as plain objects so it can cross the RSC boundary.
 */
export interface TaxonomyUsage {
  subjects: Record<string, TaxonomyStatusBreakdown>
  topics: Record<string, TaxonomyStatusBreakdown>
  questionTypes: Record<string, TaxonomyStatusBreakdown>
  /** subject id -> tag -> question count (tags scoped to where they're used). */
  tagsBySubject: Record<string, Record<string, number>>
  /** tag -> question count across the whole bank. */
  tagTotals: Record<string, number>
}

function emptyBreakdown(): TaxonomyStatusBreakdown {
  return { total: 0, published: 0, draft: 0, archived: 0 }
}

function bump(
  target: Record<string, TaxonomyStatusBreakdown>,
  key: string | null,
  status: QuestionStatus
) {
  if (!key) {
    return
  }
  const entry = target[key] ?? emptyBreakdown()
  entry.total += 1
  entry[status] += 1
  target[key] = entry
}

/**
 * Aggregates taxonomy usage from one slim scan of the questions table
 * (ids + status + tags only — no question text). This is what lets the
 * taxonomy page show real "N questions use this" counts, surface unused
 * categories, and guard destructive actions.
 */
export async function getTaxonomyUsage(): Promise<TaxonomyUsage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('subject_id, topic_id, question_type_id, status, tags')

  if (error) {
    throw new Error('Unable to load taxonomy usage.')
  }

  const usage: TaxonomyUsage = {
    subjects: {},
    topics: {},
    questionTypes: {},
    tagsBySubject: {},
    tagTotals: {},
  }

  for (const row of (data ?? []) as Array<{
    subject_id: string | null
    topic_id: string | null
    question_type_id: string | null
    status: QuestionStatus
    tags: string[] | null
  }>) {
    bump(usage.subjects, row.subject_id, row.status)
    bump(usage.topics, row.topic_id, row.status)
    bump(usage.questionTypes, row.question_type_id, row.status)

    for (const rawTag of row.tags ?? []) {
      const tag = rawTag.trim()
      if (!tag) {
        continue
      }
      usage.tagTotals[tag] = (usage.tagTotals[tag] ?? 0) + 1
      if (row.subject_id) {
        const subjectTags = usage.tagsBySubject[row.subject_id] ?? {}
        subjectTags[tag] = (subjectTags[tag] ?? 0) + 1
        usage.tagsBySubject[row.subject_id] = subjectTags
      }
    }
  }

  return usage
}
