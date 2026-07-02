import { createClient } from '@/lib/supabase/server'
import type { CsvImportableQuestion, QuestionCsvImportSummary } from '@/lib/types'

function buildDuplicateKey(question: {
  exam_type: string
  subject_id: string
  topic_id: string
  question_text: string
}): string {
  return [
    question.exam_type,
    question.subject_id,
    question.topic_id,
    question.question_text.replace(/\s+/g, ' ').trim().toLowerCase(),
  ].join('|')
}

function buildQuestionPayload(row: CsvImportableQuestion, actorId: string) {
  const publishedAt = row.status === 'published' ? new Date().toISOString() : null
  const archivedAt = row.status === 'archived' ? new Date().toISOString() : null

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
    published_at: publishedAt,
    archived_at: archivedAt,
  }
}

function buildOptionRows(questionId: string, row: CsvImportableQuestion) {
  return [
    { question_id: questionId, label: 'A', option_text: row.optionA, sort_order: 1 },
    { question_id: questionId, label: 'B', option_text: row.optionB, sort_order: 2 },
    { question_id: questionId, label: 'C', option_text: row.optionC, sort_order: 3 },
    { question_id: questionId, label: 'D', option_text: row.optionD, sort_order: 4 },
  ]
}

export async function importQuestionsFromCsvRows(
  rows: CsvImportableQuestion[],
  actorId: string
): Promise<QuestionCsvImportSummary> {
  const supabase = await createClient()
  const rowMessages: QuestionCsvImportSummary['rowMessages'] = []
  const importedQuestionIds: string[] = []

  if (!rows.length) {
    return {
      importedCount: 0,
      skippedDuplicateCount: 0,
      importedQuestionIds,
      rowMessages,
    }
  }

  const questionTexts = [...new Set(rows.map((row) => row.questionText))]
  const { data: existingQuestions, error: existingQuestionsError } = await supabase
    .from('questions')
    .select('exam_type, subject_id, topic_id, question_text')
    .in('question_text', questionTexts)

  if (existingQuestionsError) {
    throw new Error('Unable to check for existing questions before import.')
  }

  const existingKeys = new Set(
    ((existingQuestions ?? []) as Array<{
      exam_type: string
      subject_id: string
      topic_id: string
      question_text: string
    }>).map((question) => buildDuplicateKey(question))
  )

  let importedCount = 0
  let skippedDuplicateCount = 0

  for (const row of rows) {
    const duplicateKey = buildDuplicateKey({
      exam_type: row.examType,
      subject_id: row.subjectId,
      topic_id: row.topicId,
      question_text: row.questionText,
    })

    if (existingKeys.has(duplicateKey)) {
      skippedDuplicateCount += 1
      rowMessages.push({
        rowNumber: row.rowNumber,
        message: 'Skipped because a matching question already exists.',
        status: 'skipped',
      })
      continue
    }

    const { data: insertedQuestion, error: insertQuestionError } = await supabase
      .from('questions')
      .insert(buildQuestionPayload(row, actorId))
      .select('id')
      .single()

    if (insertQuestionError || !insertedQuestion) {
      throw new Error(`Unable to import row ${row.rowNumber}.`)
    }

    const { error: insertOptionsError } = await supabase
      .from('question_options')
      .insert(buildOptionRows(insertedQuestion.id, row))

    if (insertOptionsError) {
      throw new Error(`Question row ${row.rowNumber} was created, but its options could not be saved.`)
    }

    importedCount += 1
    importedQuestionIds.push(insertedQuestion.id)
    existingKeys.add(duplicateKey)
    rowMessages.push({
      rowNumber: row.rowNumber,
      message: 'Imported successfully.',
      status: 'imported',
    })
  }

  return {
    importedCount,
    skippedDuplicateCount,
    importedQuestionIds,
    rowMessages,
  }
}
