import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion } from '@/lib/import/types'
import { labelsForCount } from '@/lib/questions/option-rules'
import { slugify } from '@/lib/questions/slug'
import { ensureQuestionType, ensureTopic } from '@/lib/questions/taxonomy-mutations'
import { createClient } from '@/lib/supabase/server'
import type { QuestionSource } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function buildQuestionPayload(
  row: ResolvedImportQuestion,
  topicId: string,
  questionTypeId: string | null,
  actorId: string,
  source: QuestionSource
) {
  const now = new Date().toISOString()
  return {
    subject_id: row.subjectId,
    topic_id: topicId,
    question_type_id: questionTypeId,
    exam_type: row.examType,
    year_level: row.yearLevel,
    difficulty: row.difficulty,
    question_text: row.questionText,
    passage_text: row.passageText,
    short_explanation: row.shortExplanation,
    worked_solution: row.workedSolution,
    correct_option_label: row.correctOptionLabel,
    status: row.status,
    source,
    tags: row.tags,
    created_by: actorId,
    updated_by: actorId,
    published_at: row.status === 'published' ? now : null,
    archived_at: row.status === 'archived' ? now : null,
  }
}

function buildOptionRows(questionId: string, row: ResolvedImportQuestion) {
  const labels = labelsForCount(row.options.length)
  return row.options.map((text, index) => ({
    question_id: questionId,
    label: labels[index],
    option_text: text,
    sort_order: index + 1,
  }))
}

/**
 * Resolves the topic id for a row, creating the topic (and caching it) when the
 * row arrived with a null topicId. Cache key is (subjectId, slug) to match the
 * DB unique constraint and to dedupe repeated names within one import.
 */
async function resolveTopicId(
  supabase: SupabaseServerClient,
  row: ResolvedImportQuestion,
  cache: Map<string, string>,
  created: Set<string>
): Promise<string> {
  if (row.topicId) {
    return row.topicId
  }
  const key = `${row.subjectId}:${slugify(row.topicName)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const before = created.has(key)
  const id = await ensureTopic(supabase, row.subjectId, row.topicName)
  cache.set(key, id)
  if (!before) {
    created.add(key)
  }
  return id
}

async function resolveQuestionTypeId(
  supabase: SupabaseServerClient,
  row: ResolvedImportQuestion,
  topicId: string,
  cache: Map<string, string>,
  created: Set<string>
): Promise<string | null> {
  if (row.questionTypeId) {
    return row.questionTypeId
  }
  if (!row.questionTypeName) {
    return null
  }
  const key = `${row.subjectId}:${slugify(row.questionTypeName)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const id = await ensureQuestionType(supabase, row.subjectId, topicId, row.questionTypeName)
  cache.set(key, id)
  created.add(key)
  return id
}

/**
 * Inserts fully validated import rows as questions + their options (4 or 5 each),
 * auto-creating any missing topics/question types along the way (deduped).
 * Re-checks existing question text at insert time so duplicates are never silently imported.
 */
export async function importValidatedQuestions(
  rows: ResolvedImportQuestion[],
  actorId: string,
  source: QuestionSource
): Promise<{ summary: ImportSummary; importedQuestionIds: string[] }> {
  const supabase = await createClient()
  const importedQuestionIds: string[] = []

  const emptySummary: ImportSummary = {
    importedCount: 0,
    skippedDuplicateCount: 0,
    createdTopicCount: 0,
    createdQuestionTypeCount: 0,
    failedCount: 0,
  }

  if (rows.length === 0) {
    return { summary: emptySummary, importedQuestionIds }
  }

  const { data: existing, error: existingError } = await supabase.from('questions').select('question_text')
  if (existingError) {
    throw new Error('Unable to verify existing questions before import.')
  }
  const existingKeys = new Set(
    ((existing ?? []) as Array<{ question_text: string }>).map((row) => normalizeQuestionText(row.question_text))
  )

  const topicCache = new Map<string, string>()
  const typeCache = new Map<string, string>()
  const createdTopics = new Set<string>()
  const createdTypes = new Set<string>()

  let importedCount = 0
  let skippedDuplicateCount = 0
  let failedCount = 0

  for (const row of rows) {
    const key = normalizeQuestionText(row.questionText)
    if (existingKeys.has(key)) {
      // Duplicates only reach here when the admin chose to import them; still
      // guard against inserting the SAME text twice in one run.
      skippedDuplicateCount += 1
      continue
    }

    try {
      const topicId = await resolveTopicId(supabase, row, topicCache, createdTopics)
      const questionTypeId = await resolveQuestionTypeId(supabase, row, topicId, typeCache, createdTypes)

      const { data: inserted, error: insertError } = await supabase
        .from('questions')
        .insert(buildQuestionPayload(row, topicId, questionTypeId, actorId, source))
        .select('id')
        .single()

      if (insertError || !inserted) {
        failedCount += 1
        continue
      }

      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(buildOptionRows(inserted.id, row))

      if (optionsError) {
        failedCount += 1
        continue
      }

      importedCount += 1
      importedQuestionIds.push(inserted.id)
      existingKeys.add(key)
    } catch {
      failedCount += 1
    }
  }

  return {
    summary: {
      importedCount,
      skippedDuplicateCount,
      createdTopicCount: createdTopics.size,
      createdQuestionTypeCount: createdTypes.size,
      failedCount,
    },
    importedQuestionIds,
  }
}
