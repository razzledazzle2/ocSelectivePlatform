import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion } from '@/lib/import/types'
import { labelsForCount } from '@/lib/questions/option-rules'
import { createClient } from '@/lib/supabase/server'
import type { QuestionSource } from '@/lib/types'

function buildQuestionPayload(row: ResolvedImportQuestion, actorId: string, source: QuestionSource) {
  const now = new Date().toISOString()
  return {
    subject_id: row.subjectId,
    topic_id: row.topicId,
    question_type_id: row.questionTypeId,
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
 * Inserts fully validated import rows as questions + their options (4 or 5 each).
 * Re-checks existing question text at insert time so duplicates are never silently imported.
 */
export async function importValidatedQuestions(
  rows: ResolvedImportQuestion[],
  actorId: string,
  source: QuestionSource
): Promise<{ summary: ImportSummary; importedQuestionIds: string[] }> {
  const supabase = await createClient()
  const importedQuestionIds: string[] = []

  if (rows.length === 0) {
    return {
      summary: { importedCount: 0, skippedDuplicateCount: 0, failedCount: 0 },
      importedQuestionIds,
    }
  }

  const { data: existing, error: existingError } = await supabase.from('questions').select('question_text')
  if (existingError) {
    throw new Error('Unable to verify existing questions before import.')
  }
  const existingKeys = new Set(
    ((existing ?? []) as Array<{ question_text: string }>).map((row) => normalizeQuestionText(row.question_text))
  )

  let importedCount = 0
  let skippedDuplicateCount = 0
  let failedCount = 0

  for (const row of rows) {
    const key = normalizeQuestionText(row.questionText)
    if (existingKeys.has(key)) {
      skippedDuplicateCount += 1
      continue
    }

    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(buildQuestionPayload(row, actorId, source))
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
  }

  return {
    summary: { importedCount, skippedDuplicateCount, failedCount },
    importedQuestionIds,
  }
}
