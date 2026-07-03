import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion } from '@/lib/import/types'
import { createClient } from '@/lib/supabase/server'

function buildQuestionPayload(row: ResolvedImportQuestion, actorId: string) {
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
    created_by: actorId,
    updated_by: actorId,
    published_at: row.status === 'published' ? now : null,
    archived_at: row.status === 'archived' ? now : null,
  }
}

function buildOptionRows(questionId: string, row: ResolvedImportQuestion) {
  return [
    { question_id: questionId, label: 'A', option_text: row.optionA, sort_order: 1 },
    { question_id: questionId, label: 'B', option_text: row.optionB, sort_order: 2 },
    { question_id: questionId, label: 'C', option_text: row.optionC, sort_order: 3 },
    { question_id: questionId, label: 'D', option_text: row.optionD, sort_order: 4 },
  ]
}

/**
 * Inserts fully validated import rows as questions + four options each.
 * Re-checks existing question text at insert time so duplicates are never silently imported.
 */
export async function importValidatedQuestions(
  rows: ResolvedImportQuestion[],
  actorId: string
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
      .insert(buildQuestionPayload(row, actorId))
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
