import { createClient } from '@/lib/supabase/server'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  type ActionResult,
  type QuestionOptionLabel,
  type QuestionOptionRecord,
  type QuestionWriteInput,
} from '@/lib/types'

function readTrimmedValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function isValidExamType(value: string): value is QuestionWriteInput['examType'] {
  return EXAM_TYPES.includes(value as QuestionWriteInput['examType'])
}

function isValidOptionLabel(value: string): value is QuestionOptionLabel {
  return QUESTION_OPTION_LABELS.includes(value as QuestionOptionLabel)
}

function buildOptions(formData: FormData): QuestionOptionRecord[] {
  return QUESTION_OPTION_LABELS.map((label, index) => ({
    label,
    option_text: readTrimmedValue(formData, `option${label}`),
    sort_order: index + 1,
  }))
}

export function parseQuestionWriteInput(formData: FormData): ActionResult<QuestionWriteInput> {
  const fieldErrors: Record<string, string> = {}
  const examType = readTrimmedValue(formData, 'examType')
  const subjectId = readTrimmedValue(formData, 'subjectId')
  const topicId = readTrimmedValue(formData, 'topicId')
  const questionTypeId = readTrimmedValue(formData, 'questionTypeId') || null
  const yearLevelValue = readTrimmedValue(formData, 'yearLevel')
  const difficultyValue = readTrimmedValue(formData, 'difficulty')
  const questionText = readTrimmedValue(formData, 'questionText')
  const passageText = readTrimmedValue(formData, 'passageText')
  const shortExplanation = readTrimmedValue(formData, 'shortExplanation')
  const workedSolution = readTrimmedValue(formData, 'workedSolution')
  const correctOptionLabel = readTrimmedValue(formData, 'correctOptionLabel')
  const status = readTrimmedValue(formData, 'status')
  const options = buildOptions(formData)

  if (!isValidExamType(examType)) {
    fieldErrors.examType = 'Choose OC or Selective.'
  }

  if (!subjectId) {
    fieldErrors.subjectId = 'Choose a subject.'
  }

  if (!topicId) {
    fieldErrors.topicId = 'Choose a topic.'
  }

  const difficulty = Number(difficultyValue)

  if (!difficultyValue || Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
    fieldErrors.difficulty = 'Choose a difficulty from 1 to 5.'
  }

  if (!questionText) {
    fieldErrors.questionText = 'Question text is required.'
  }

  for (const option of options) {
    if (!option.option_text) {
      fieldErrors[`option${option.label}`] = `Option ${option.label} is required.`
    }
  }

  if (!isValidOptionLabel(correctOptionLabel)) {
    fieldErrors.correctOptionLabel = 'Choose the correct option.'
  }

  if (!workedSolution) {
    fieldErrors.workedSolution = 'Worked solution is required.'
  }

  if (status !== 'draft' && status !== 'published') {
    fieldErrors.status = 'Choose draft or published.'
  }

  const yearLevel = yearLevelValue ? Number(yearLevelValue) : null

  if (yearLevelValue && (Number.isNaN(yearLevel) || yearLevel < 3 || yearLevel > 12)) {
    fieldErrors.yearLevel = 'Year level must be between 3 and 12.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
      message: 'Please fix the highlighted fields and try again.',
    }
  }

  const normalizedExamType = examType as QuestionWriteInput['examType']
  const normalizedCorrectOptionLabel = correctOptionLabel as QuestionOptionLabel
  const normalizedStatus = status as QuestionWriteInput['status']

  return {
    success: true,
    data: {
      examType: normalizedExamType,
      subjectId,
      topicId,
      questionTypeId,
      yearLevel,
      difficulty,
      questionText,
      passageText: passageText || null,
      options,
      correctOptionLabel: normalizedCorrectOptionLabel,
      shortExplanation: shortExplanation || null,
      workedSolution,
      status: normalizedStatus,
    },
  }
}

function buildQuestionPayload(input: QuestionWriteInput, actorId: string) {
  const publishedAt = input.status === 'published' ? new Date().toISOString() : null

  return {
    subject_id: input.subjectId,
    topic_id: input.topicId,
    question_type_id: input.questionTypeId,
    exam_type: input.examType,
    year_level: input.yearLevel,
    difficulty: input.difficulty,
    question_text: input.questionText,
    passage_text: input.passageText,
    short_explanation: input.shortExplanation,
    worked_solution: input.workedSolution,
    correct_option_label: input.correctOptionLabel,
    status: input.status,
    created_by: actorId,
    updated_by: actorId,
    published_at: publishedAt,
    archived_at: null,
  }
}

function buildOptionRows(questionId: string, options: QuestionOptionRecord[]) {
  return options.map((option) => ({
    question_id: questionId,
    label: option.label,
    option_text: option.option_text,
    sort_order: option.sort_order,
  }))
}

export async function createQuestion(input: QuestionWriteInput, actorId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .insert(buildQuestionPayload(input, actorId))
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create the question.')
  }

  const { error: optionsError } = await supabase
    .from('question_options')
    .insert(buildOptionRows(data.id, input.options))

  if (optionsError) {
    throw new Error('Question saved, but the answer options could not be created.')
  }

  return data.id
}

export async function updateQuestion(questionId: string, input: QuestionWriteInput, actorId: string): Promise<string> {
  const supabase = await createClient()
  const { data: existingQuestion, error: loadError } = await supabase
    .from('questions')
    .select('published_at')
    .eq('id', questionId)
    .maybeSingle()

  if (loadError) {
    throw new Error('Unable to load the existing question before saving.')
  }

  const publishedAt =
    input.status === 'published'
      ? existingQuestion?.published_at ?? new Date().toISOString()
      : null

  const { error } = await supabase
    .from('questions')
    .update({
      subject_id: input.subjectId,
      topic_id: input.topicId,
      question_type_id: input.questionTypeId,
      exam_type: input.examType,
      year_level: input.yearLevel,
      difficulty: input.difficulty,
      question_text: input.questionText,
      passage_text: input.passageText,
      short_explanation: input.shortExplanation,
      worked_solution: input.workedSolution,
      correct_option_label: input.correctOptionLabel,
      status: input.status,
      published_at: publishedAt,
      archived_at: null,
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to update the question.')
  }

  const { error: optionsError } = await supabase
    .from('question_options')
    .upsert(buildOptionRows(questionId, input.options), {
      onConflict: 'question_id,label',
    })

  if (optionsError) {
    throw new Error('Question updated, but the answer options could not be saved.')
  }

  return questionId
}

export async function archiveQuestion(questionId: string, actorId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('questions')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to archive the question.')
  }
}

export async function publishQuestion(questionId: string, actorId: string): Promise<void> {
  const supabase = await createClient()
  const { data: existingQuestion, error: loadError } = await supabase
    .from('questions')
    .select('published_at')
    .eq('id', questionId)
    .maybeSingle()

  if (loadError) {
    throw new Error('Unable to load the question before publishing.')
  }

  const { error } = await supabase
    .from('questions')
    .update({
      status: 'published',
      published_at: existingQuestion?.published_at ?? new Date().toISOString(),
      archived_at: null,
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to publish the question.')
  }
}

export async function unpublishQuestion(questionId: string, actorId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('questions')
    .update({
      status: 'draft',
      published_at: null,
      archived_at: null,
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to move the question back to draft.')
  }
}

/**
 * Copies an existing question (and its four options) into a new draft.
 * 'duplicate' prefixes the text with "Copy of "; 'similar' keeps the text for the admin to edit.
 * The original question is never modified.
 */
export async function duplicateQuestion(
  questionId: string,
  actorId: string,
  mode: 'duplicate' | 'similar'
): Promise<string> {
  const supabase = await createClient()

  const { data: original, error: loadError } = await supabase
    .from('questions')
    .select(
      'subject_id, topic_id, question_type_id, exam_type, year_level, difficulty, question_text, passage_text, short_explanation, worked_solution, correct_option_label'
    )
    .eq('id', questionId)
    .maybeSingle()

  if (loadError || !original) {
    throw new Error('Unable to load the original question.')
  }

  const { data: options, error: optionsLoadError } = await supabase
    .from('question_options')
    .select('label, option_text, sort_order')
    .eq('question_id', questionId)
    .order('sort_order', { ascending: true })

  if (optionsLoadError) {
    throw new Error('Unable to load the original options.')
  }

  const questionText = mode === 'duplicate' ? `Copy of ${original.question_text}` : original.question_text

  const { data: inserted, error: insertError } = await supabase
    .from('questions')
    .insert({
      subject_id: original.subject_id,
      topic_id: original.topic_id,
      question_type_id: original.question_type_id,
      exam_type: original.exam_type,
      year_level: original.year_level,
      difficulty: original.difficulty,
      question_text: questionText,
      passage_text: original.passage_text,
      short_explanation: original.short_explanation,
      worked_solution: original.worked_solution,
      correct_option_label: original.correct_option_label,
      status: 'draft',
      created_by: actorId,
      updated_by: actorId,
      published_at: null,
      archived_at: null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    throw new Error('Unable to create the copied question.')
  }

  const optionRows = ((options ?? []) as Array<{ label: string; option_text: string; sort_order: number }>).map(
    (option) => ({
      question_id: inserted.id,
      label: option.label,
      option_text: option.option_text,
      sort_order: option.sort_order,
    })
  )

  if (optionRows.length > 0) {
    const { error: optionsInsertError } = await supabase.from('question_options').insert(optionRows)
    if (optionsInsertError) {
      throw new Error('The question was copied, but its options could not be saved.')
    }
  }

  return inserted.id
}
