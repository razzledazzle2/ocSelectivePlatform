import { MAX_OPTION_COUNT, MIN_OPTION_COUNT } from '@/lib/questions/option-rules'
import { parseWritingRubric } from '@/lib/questions/rubric'
import { createClient } from '@/lib/supabase/server'
import {
  ANSWER_FORMATS,
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  type ActionResult,
  type AnswerFormat,
  type QuestionOptionLabel,
  type QuestionOptionRecord,
  type QuestionWriteInput,
} from '@/lib/types'

/** Splits a comma-separated tags string into trimmed, de-duplicated tags. */
export function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

function readTrimmedValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function isValidExamType(value: string): value is QuestionWriteInput['examType'] {
  return EXAM_TYPES.includes(value as QuestionWriteInput['examType'])
}

function isValidAnswerFormat(value: string): value is AnswerFormat {
  return ANSWER_FORMATS.includes(value as AnswerFormat)
}

function isValidOptionLabel(value: string): value is QuestionOptionLabel {
  return QUESTION_OPTION_LABELS.includes(value as QuestionOptionLabel)
}

/**
 * Reads a flexible number of options (A–E). Only labels whose field was
 * actually submitted are included, so a 4-option question simply omits E.
 */
function buildOptions(formData: FormData): QuestionOptionRecord[] {
  return QUESTION_OPTION_LABELS.filter((label) => formData.get(`option${label}`) !== null).map(
    (label, index) => ({
      label,
      option_text: readTrimmedValue(formData, `option${label}`),
      sort_order: index + 1,
    })
  )
}

export function parseQuestionWriteInput(formData: FormData): ActionResult<QuestionWriteInput> {
  const fieldErrors: Record<string, string> = {}
  const examType = readTrimmedValue(formData, 'examType')
  const subjectId = readTrimmedValue(formData, 'subjectId')
  const topicId = readTrimmedValue(formData, 'topicId')
  const questionTypeId = readTrimmedValue(formData, 'questionTypeId') || null
  const yearLevelValue = readTrimmedValue(formData, 'yearLevel')
  const difficultyValue = readTrimmedValue(formData, 'difficulty')
  const answerFormatValue = readTrimmedValue(formData, 'answerFormat') || 'single_choice'
  const marksValue = readTrimmedValue(formData, 'marks')
  const timeLimitValue = readTrimmedValue(formData, 'timeLimitSeconds')
  const questionText = readTrimmedValue(formData, 'questionText')
  const passageText = readTrimmedValue(formData, 'passageText')
  const stimulusId = readTrimmedValue(formData, 'stimulusId') || null
  const shortExplanation = readTrimmedValue(formData, 'shortExplanation')
  const workedSolution = readTrimmedValue(formData, 'workedSolution')
  const correctOptionLabel = readTrimmedValue(formData, 'correctOptionLabel')
  const status = readTrimmedValue(formData, 'status')
  const tags = parseTags(readTrimmedValue(formData, 'tags'))
  const skillTags = parseTags(readTrimmedValue(formData, 'skillTags'))
  const conceptTags = parseTags(readTrimmedValue(formData, 'conceptTags'))
  const rubricJson = String(formData.get('rubricJson') ?? '')

  if (!isValidExamType(examType)) {
    fieldErrors.examType = 'Choose OC or Selective.'
  }

  if (!isValidAnswerFormat(answerFormatValue)) {
    fieldErrors.answerFormat = 'Choose a valid answer format.'
  }
  const answerFormat: AnswerFormat = isValidAnswerFormat(answerFormatValue) ? answerFormatValue : 'single_choice'
  const isSingleChoice = answerFormat === 'single_choice'

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

  const marks = marksValue ? Number(marksValue) : 1
  if (marksValue && (!Number.isInteger(marks) || marks < 1)) {
    fieldErrors.marks = 'Marks must be a positive whole number.'
  }

  let timeLimitSeconds: number | null = null
  if (timeLimitValue) {
    const parsedTimeLimit = Number(timeLimitValue)
    if (!Number.isInteger(parsedTimeLimit) || parsedTimeLimit < 1) {
      fieldErrors.timeLimitSeconds = 'Time limit must be a positive whole number of seconds.'
    } else {
      timeLimitSeconds = parsedTimeLimit
    }
  }

  if (!questionText) {
    fieldErrors.questionText = 'Question text is required.'
  }

  // Options: required for single_choice, forbidden for extended_response.
  let options = buildOptions(formData)

  if (isSingleChoice) {
    for (const option of options) {
      if (!option.option_text) {
        fieldErrors[`option${option.label}`] = `Option ${option.label} is required.`
      }
    }

    if (options.length < MIN_OPTION_COUNT || options.length > MAX_OPTION_COUNT) {
      fieldErrors.options = `Questions need between ${MIN_OPTION_COUNT} and ${MAX_OPTION_COUNT} options.`
    }

    const filledTexts = options.map((option) => option.option_text.toLowerCase()).filter(Boolean)
    if (new Set(filledTexts).size !== filledTexts.length) {
      fieldErrors.options = 'Options must be unique within a question.'
    }

    if (!isValidOptionLabel(correctOptionLabel)) {
      fieldErrors.correctOptionLabel = 'Choose the correct option.'
    } else if (!options.some((option) => option.label === correctOptionLabel)) {
      fieldErrors.correctOptionLabel = `Correct answer is ${correctOptionLabel}, but this question only has options ${options
        .map((option) => option.label)
        .join('–')}.`
    }

    if (!workedSolution) {
      fieldErrors.workedSolution = 'Worked solution is required.'
    }
  } else {
    const filledOptions = options.filter((option) => option.option_text)
    if (filledOptions.length > 0) {
      fieldErrors.options = 'Extended response questions must not have answer options.'
    }
    options = []
  }

  const { rubric, error: rubricError } = parseWritingRubric(rubricJson)
  if (rubricError) {
    fieldErrors.rubricJson = rubricError
  }

  if (status !== 'draft' && status !== 'reviewed' && status !== 'published') {
    fieldErrors.status = 'Choose draft, reviewed or published.'
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

  return {
    success: true,
    data: {
      examType: examType as QuestionWriteInput['examType'],
      subjectId,
      topicId,
      questionTypeId,
      yearLevel,
      difficulty,
      answerFormat,
      marks,
      timeLimitSeconds,
      questionText,
      passageText: passageText || null,
      stimulusId,
      options,
      correctOptionLabel: isSingleChoice ? (correctOptionLabel as QuestionOptionLabel) : null,
      shortExplanation: shortExplanation || null,
      workedSolution: workedSolution || null,
      tags,
      skillTags,
      conceptTags,
      rubric,
      status: status as QuestionWriteInput['status'],
    },
  }
}

/** Confirms a linked stimulus exists before writing (friendlier than the FK error). */
export async function validateStimulusExists(stimulusId: string | null): Promise<Record<string, string>> {
  if (!stimulusId) {
    return {}
  }

  const supabase = await createClient()
  const { data } = await supabase.from('stimuli').select('id').eq('id', stimulusId).maybeSingle()

  return data ? {} : { stimulusId: 'The linked stimulus could not be found.' }
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
    answer_format: input.answerFormat,
    marks: input.marks,
    time_limit_seconds: input.timeLimitSeconds,
    question_text: input.questionText,
    passage_text: input.passageText,
    stimulus_id: input.stimulusId,
    short_explanation: input.shortExplanation,
    worked_solution: input.workedSolution,
    correct_option_label: input.correctOptionLabel,
    status: input.status,
    source: 'manual',
    tags: input.tags,
    skill_tags: input.skillTags,
    concept_tags: input.conceptTags,
    rubric: input.rubric,
    presentation: input.presentation ?? {},
    source_info: input.sourceInfo ?? {},
    ...(input.externalId !== undefined ? { external_id: input.externalId } : {}),
    ...(input.variantId !== undefined ? { variant_id: input.variantId } : {}),
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
    asset_id: option.asset_id ?? null,
    explanation: option.explanation ?? null,
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

  if (input.options.length > 0) {
    const { error: optionsError } = await supabase
      .from('question_options')
      .insert(buildOptionRows(data.id, input.options))

    if (optionsError) {
      throw new Error('Question saved, but the answer options could not be created.')
    }
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

  if (input.status === 'published') {
    await assertAssetsReadyForPublish(questionId)
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
      answer_format: input.answerFormat,
      marks: input.marks,
      time_limit_seconds: input.timeLimitSeconds,
      question_text: input.questionText,
      passage_text: input.passageText,
      stimulus_id: input.stimulusId,
      short_explanation: input.shortExplanation,
      worked_solution: input.workedSolution,
      correct_option_label: input.correctOptionLabel,
      status: input.status,
      tags: input.tags,
      skill_tags: input.skillTags,
      concept_tags: input.conceptTags,
      rubric: input.rubric,
      ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
      ...(input.sourceInfo !== undefined ? { source_info: input.sourceInfo } : {}),
      ...(input.externalId !== undefined ? { external_id: input.externalId } : {}),
      ...(input.variantId !== undefined ? { variant_id: input.variantId } : {}),
      published_at: publishedAt,
      archived_at: null,
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to update the question.')
  }

  // The form round-trips option texts only — carry existing asset/explanation
  // metadata through by label so an edit never silently drops visual options.
  const { data: existingOptions, error: existingOptionsError } = await supabase
    .from('question_options')
    .select('label, asset_id, explanation')
    .eq('question_id', questionId)

  if (existingOptionsError) {
    throw new Error('Question updated, but the existing answer options could not be read.')
  }

  const existingByLabel = new Map(
    ((existingOptions ?? []) as Array<{ label: string; asset_id: string | null; explanation: string | null }>).map(
      (option) => [option.label, option]
    )
  )
  const mergedOptions = input.options.map((option) => ({
    ...option,
    asset_id: option.asset_id ?? existingByLabel.get(option.label)?.asset_id ?? null,
    explanation: option.explanation ?? existingByLabel.get(option.label)?.explanation ?? null,
  }))

  if (mergedOptions.length > 0) {
    const { error: optionsError } = await supabase
      .from('question_options')
      .upsert(buildOptionRows(questionId, mergedOptions), {
        onConflict: 'question_id,label',
      })

    if (optionsError) {
      throw new Error('Question updated, but the answer options could not be saved.')
    }
  }

  // If the edit reduced the option count (e.g. 5 → 4, or a switch to extended
  // response), remove the stale labels.
  const keptLabels = mergedOptions.map((option) => option.label)
  let staleQuery = supabase.from('question_options').delete().eq('question_id', questionId)
  if (keptLabels.length > 0) {
    staleQuery = staleQuery.not('label', 'in', `(${keptLabels.map((label) => `"${label}"`).join(',')})`)
  }
  const { error: staleError } = await staleQuery

  if (staleError) {
    throw new Error('Question updated, but old answer options could not be removed.')
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

/**
 * Asset statuses that block publishing: a placeholder with no file, or one that
 * was reviewed and rejected. Publishing either would show students a broken /
 * "coming soon" diagram in place of a required visual.
 */
const PUBLISH_BLOCKING_ASSET_STATUSES = ['pending', 'rejected'] as const

/** Count of question/solution/option assets that aren't ready to show students. */
export async function countUnreadyQuestionAssets(questionId: string): Promise<number> {
  const supabase = await createClient()

  const [{ data: linked }, { data: options }] = await Promise.all([
    supabase.from('question_assets').select('asset:assets(status)').eq('question_id', questionId),
    supabase
      .from('question_options')
      .select('asset:assets(status)')
      .eq('question_id', questionId)
      .not('asset_id', 'is', null),
  ])

  const rows = [...(linked ?? []), ...(options ?? [])] as Array<{
    asset: { status: string } | { status: string }[] | null
  }>

  return rows.reduce((count, row) => {
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset
    const status = asset?.status
    return status && (PUBLISH_BLOCKING_ASSET_STATUSES as readonly string[]).includes(status) ? count + 1 : count
  }, 0)
}

/** Throws a clear, user-facing error when a question still has unready required assets. */
export async function assertAssetsReadyForPublish(questionId: string): Promise<void> {
  const unready = await countUnreadyQuestionAssets(questionId)
  if (unready > 0) {
    throw new Error(
      `This question has ${unready} pending or rejected asset${unready === 1 ? '' : 's'}. ` +
        'Generate and approve the diagram(s) before publishing so students never see a missing image.'
    )
  }
}

export async function publishQuestion(questionId: string, actorId: string): Promise<void> {
  const supabase = await createClient()
  await assertAssetsReadyForPublish(questionId)

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

/** Marks a draft question as reviewed (content checked, not yet visible to students). */
export async function markQuestionReviewed(questionId: string, actorId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('questions')
    .update({
      status: 'reviewed',
      published_at: null,
      archived_at: null,
      updated_by: actorId,
    })
    .eq('id', questionId)

  if (error) {
    throw new Error('Unable to mark the question as reviewed.')
  }
}

/**
 * Copies an existing question (and its options) into a new draft.
 * 'duplicate' prefixes the text with "Copy of "; 'similar' keeps the text for the admin to edit.
 * The original question is never modified. external_id is never copied (it is unique).
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
      'subject_id, topic_id, question_type_id, exam_type, year_level, difficulty, answer_format, marks, time_limit_seconds, question_text, passage_text, stimulus_id, variant_id, short_explanation, worked_solution, correct_option_label, tags, skill_tags, concept_tags, rubric, presentation, source_info'
    )
    .eq('id', questionId)
    .maybeSingle()

  if (loadError || !original) {
    throw new Error('Unable to load the original question.')
  }

  const { data: options, error: optionsLoadError } = await supabase
    .from('question_options')
    .select('label, option_text, sort_order, asset_id, explanation')
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
      answer_format: original.answer_format,
      marks: original.marks,
      time_limit_seconds: original.time_limit_seconds,
      question_text: questionText,
      passage_text: original.passage_text,
      stimulus_id: original.stimulus_id,
      variant_id: original.variant_id,
      short_explanation: original.short_explanation,
      worked_solution: original.worked_solution,
      correct_option_label: original.correct_option_label,
      tags: original.tags ?? [],
      skill_tags: original.skill_tags ?? [],
      concept_tags: original.concept_tags ?? [],
      rubric: original.rubric,
      presentation: original.presentation ?? {},
      source_info: original.source_info ?? {},
      status: 'draft',
      source: 'manual',
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

  const optionRows = (
    (options ?? []) as Array<{
      label: string
      option_text: string
      sort_order: number
      asset_id: string | null
      explanation: string | null
    }>
  ).map((option) => ({
    question_id: inserted.id,
    label: option.label,
    option_text: option.option_text,
    sort_order: option.sort_order,
    asset_id: option.asset_id,
    explanation: option.explanation,
  }))

  if (optionRows.length > 0) {
    const { error: optionsInsertError } = await supabase.from('question_options').insert(optionRows)
    if (optionsInsertError) {
      throw new Error('The question was copied, but its options could not be saved.')
    }
  }

  const { data: assetLinks, error: assetLinksError } = await supabase
    .from('question_assets')
    .select('asset_id, role, sort_order')
    .eq('question_id', questionId)

  if (!assetLinksError && (assetLinks ?? []).length > 0) {
    await supabase.from('question_assets').insert(
      (assetLinks as Array<{ asset_id: string; role: string; sort_order: number }>).map((link) => ({
        question_id: inserted.id,
        asset_id: link.asset_id,
        role: link.role,
        sort_order: link.sort_order,
      }))
    )
  }

  return inserted.id
}
