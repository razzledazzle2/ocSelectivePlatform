import { parseTags } from '@/lib/questions/mutations'
import { checkOptionCount, labelsForCount } from '@/lib/questions/option-rules'
import { parseWritingRubric } from '@/lib/questions/rubric'
import {
  ANSWER_FORMATS,
  ASSET_STATUSES,
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  QUESTION_STATUSES,
  STIMULUS_TYPES,
  type AnswerFormat,
  type AssetStatus,
  type ExamType,
  type QuestionOptionLabel,
  type QuestionPresentation,
  type QuestionSourceInfo,
  type QuestionStatus,
  type StimulusType,
} from '@/lib/types'
import type {
  ImportFormat,
  ImportReference,
  ImportRowIssue,
  ImportSettings,
  ImportValidationResult,
  QuestionImportRow,
  ResolvedImportQuestion,
  ResolvedImportStimulus,
  ValidatedImportRow,
} from '@/lib/import/types'

/** Parses an asset_spec_json cell into an object, or null when blank/invalid. */
function parseAssetSpec(cell: string): Record<string, unknown> | null {
  const trimmed = cell.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Normalises an asset_status cell to a known status, or null when blank/unknown. */
function parseAssetStatus(cell: string): AssetStatus | null {
  const value = cell.trim().toLowerCase()
  return (ASSET_STATUSES as readonly string[]).includes(value) ? (value as AssetStatus) : null
}

export function normalizeQuestionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeExamType(value: string): ExamType | null {
  const match = EXAM_TYPES.find((exam) => exam.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

function normalizeStimulusType(value: string): StimulusType | null {
  const match = STIMULUS_TYPES.find((type) => type === value.trim().toLowerCase())
  return match ?? null
}

/**
 * When no short explanation is supplied, derive a one-line summary from the
 * worked solution (first sentence, capped) so students still get quick feedback.
 * Returns null when there is nothing to derive from.
 */
export function deriveShortExplanation(workedSolution: string): string | null {
  const collapsed = workedSolution.replace(/\s+/g, ' ').trim()
  if (!collapsed) {
    return null
  }
  const firstSentence = collapsed.split(/(?<=[.!?])\s/)[0] ?? collapsed
  const candidate = firstSentence.length <= 160 ? firstSentence : `${collapsed.slice(0, 157)}...`
  return candidate
}

/**
 * Parses a JSON cell keyed by option label ({"A": "...", "B": "..."}).
 * Returns null for an empty cell, and an error flag for anything that is not
 * a flat object of string values keyed A–E.
 */
function parseLabelKeyedJson(cell: string): {
  map: Partial<Record<QuestionOptionLabel, string>> | null
  invalid: boolean
} {
  if (!cell.trim()) {
    return { map: null, invalid: false }
  }

  try {
    const parsed: unknown = JSON.parse(cell)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { map: null, invalid: true }
    }

    const map: Partial<Record<QuestionOptionLabel, string>> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const label = key.trim().toUpperCase()
      if (!QUESTION_OPTION_LABELS.includes(label as QuestionOptionLabel) || typeof value !== 'string') {
        return { map: null, invalid: true }
      }
      if (value.trim()) {
        map[label as QuestionOptionLabel] = value.trim()
      }
    }
    return { map, invalid: false }
  } catch {
    return { map: null, invalid: true }
  }
}

interface ReferenceMaps {
  subjectByKey: Map<string, ImportReference['subjects'][number]>
  topicByKey: Map<string, ImportReference['topics'][number]>
  questionTypeByKey: Map<string, ImportReference['questionTypes'][number]>
  variantByKey: Map<string, ImportReference['questionVariants'][number]>
  existingTags: Set<string>
  existingStimulusRefs: Set<string>
  existingExternalIds: Set<string>
}

function buildReferenceMaps(reference: ImportReference): ReferenceMaps {
  const subjectByKey = new Map<string, ImportReference['subjects'][number]>()
  for (const subject of reference.subjects) {
    subjectByKey.set(subject.name.toLowerCase(), subject)
    subjectByKey.set(subject.slug.toLowerCase(), subject)
  }

  const topicByKey = new Map<string, ImportReference['topics'][number]>()
  for (const topic of reference.topics) {
    topicByKey.set(`${topic.subject_id}:${topic.name.toLowerCase()}`, topic)
    topicByKey.set(`${topic.subject_id}:${topic.slug.toLowerCase()}`, topic)
  }

  const questionTypeByKey = new Map<string, ImportReference['questionTypes'][number]>()
  for (const questionType of reference.questionTypes) {
    questionTypeByKey.set(`${questionType.subject_id}:${questionType.name.toLowerCase()}`, questionType)
    questionTypeByKey.set(`${questionType.subject_id}:${questionType.slug.toLowerCase()}`, questionType)
  }

  const variantByKey = new Map<string, ImportReference['questionVariants'][number]>()
  for (const variant of reference.questionVariants) {
    variantByKey.set(`${variant.question_type_id}:${variant.name.toLowerCase()}`, variant)
    variantByKey.set(`${variant.question_type_id}:${variant.slug.toLowerCase()}`, variant)
  }

  return {
    subjectByKey,
    topicByKey,
    questionTypeByKey,
    variantByKey,
    existingTags: new Set(reference.existingTags.map((tag) => tag.trim().toLowerCase())),
    existingStimulusRefs: new Set(reference.existingStimulusRefs),
    existingExternalIds: new Set(reference.existingExternalIds),
  }
}

interface StimulusGroup {
  title: string
  stimulusType: string
  bodyMarkdown: string
  assetRefs: string[]
  hasDefinition: boolean
}

/**
 * Merges the stimulus definition columns across every row sharing one
 * stimulus ref — the definition may live on any single row of the group.
 */
function buildStimulusGroups(rows: QuestionImportRow[]): Map<string, StimulusGroup> {
  const groups = new Map<string, StimulusGroup>()

  for (const row of rows) {
    const ref = row.stimulusId.trim()
    if (!ref) continue

    const group = groups.get(ref) ?? {
      title: '',
      stimulusType: '',
      bodyMarkdown: '',
      assetRefs: [],
      hasDefinition: false,
    }
    if (!group.title && row.stimulusTitle.trim()) group.title = row.stimulusTitle.trim()
    if (!group.stimulusType && row.stimulusType.trim()) group.stimulusType = row.stimulusType.trim()
    if (!group.bodyMarkdown && row.stimulusText.trim()) group.bodyMarkdown = row.stimulusText.trim()
    for (const assetRef of row.stimulusAssetRefs) {
      if (!group.assetRefs.includes(assetRef)) {
        group.assetRefs.push(assetRef)
      }
    }
    group.hasDefinition =
      group.hasDefinition || Boolean(group.title || group.stimulusType || group.bodyMarkdown)
    groups.set(ref, group)
  }

  return groups
}

interface ValidateOptions {
  format: ImportFormat
  reference: ImportReference
  existingQuestionTexts: string[]
  settings: ImportSettings
}

export function validateQuestionImportRows(
  rows: QuestionImportRow[],
  options: ValidateOptions
): ImportValidationResult {
  const { settings } = options
  const maps = buildReferenceMaps(options.reference)
  const stimulusGroups = buildStimulusGroups(rows)
  const existingTextSet = new Set(options.existingQuestionTexts.map(normalizeQuestionText))
  const seenInFile = new Set<string>()
  const seenExternalIds = new Set<string>()
  const validatedRows: ValidatedImportRow[] = []

  for (const row of rows) {
    // errors block import; warnings do not.
    const errors: ImportRowIssue[] = []
    const warnings: ImportRowIssue[] = []

    // -- Subject (hard error: cannot be auto-created) -----------------------
    const subject = row.subject ? maps.subjectByKey.get(row.subject.trim().toLowerCase()) ?? null : null
    if (!row.subject.trim()) {
      errors.push({ field: 'subject', message: 'Subject is required.' })
    } else if (!subject) {
      errors.push({ field: 'subject', message: `Subject "${row.subject}" was not found. Create the subject first.` })
    }

    // -- Topic (soft: auto-create or fall back to "General" when enabled) ---
    // topicName/topicId feed ResolvedImportQuestion; a null id means "create".
    let topicId: string | null = null
    let topicName = row.topic.trim()
    const existingTopic =
      subject && topicName
        ? maps.topicByKey.get(`${subject.id}:${topicName.toLowerCase()}`) ?? null
        : null

    if (subject) {
      if (existingTopic) {
        topicId = existingTopic.id
        topicName = existingTopic.name
      } else if (!topicName) {
        // No topic given at all.
        if (settings.createMissingTopics) {
          topicName = 'General'
          warnings.push({ field: 'topic', message: 'No topic given — importing under "General".' })
        } else {
          errors.push({ field: 'topic', message: 'Topic is required.' })
        }
      } else {
        // Topic named but not found yet.
        if (settings.createMissingTopics) {
          warnings.push({ field: 'topic', message: `New topic "${topicName}" will be created under ${subject.name}.` })
        } else {
          errors.push({ field: 'topic', message: `Topic "${topicName}" was not found under ${subject.name}.` })
        }
      }
    }

    // -- Question type (optional; soft auto-create) -------------------------
    let questionTypeId: string | null = null
    let questionTypeName: string | null = row.questionType.trim() || null
    const existingType =
      subject && questionTypeName
        ? maps.questionTypeByKey.get(`${subject.id}:${questionTypeName.toLowerCase()}`) ?? null
        : null

    if (subject && questionTypeName) {
      if (existingType) {
        questionTypeId = existingType.id
        questionTypeName = existingType.name
      } else if (settings.createMissingQuestionTypes) {
        warnings.push({
          field: 'question_type',
          message: `New question type "${questionTypeName}" will be created under ${subject.name}.`,
        })
      } else {
        errors.push({
          field: 'question_type',
          message: `Question type "${questionTypeName}" was not found for ${subject.name}.`,
        })
      }
    }

    // -- Variant (optional; resolved under the question type) ---------------
    let variantId: string | null = null
    let variantName: string | null = row.variantType.trim() || null

    if (variantName && !questionTypeName) {
      warnings.push({
        field: 'variant_type',
        message: `Variant "${variantName}" ignored — it needs an essential question type.`,
      })
      variantName = null
    } else if (variantName) {
      const existingVariant = questionTypeId
        ? maps.variantByKey.get(`${questionTypeId}:${variantName.toLowerCase()}`) ?? null
        : null

      if (existingVariant) {
        variantId = existingVariant.id
        variantName = existingVariant.name
      } else if (settings.createMissingQuestionTypes) {
        warnings.push({
          field: 'variant_type',
          message: `New variant "${variantName}" will be created under ${questionTypeName}.`,
        })
      } else {
        warnings.push({
          field: 'variant_type',
          message: `Variant "${variantName}" was not found — importing without a variant.`,
        })
        variantName = null
      }
    }

    // -- Answer format -------------------------------------------------------
    const rawAnswerFormat = row.answerFormat.trim().toLowerCase()
    let answerFormat: AnswerFormat = 'single_choice'
    if (rawAnswerFormat && !ANSWER_FORMATS.includes(rawAnswerFormat as AnswerFormat)) {
      errors.push({
        field: 'answer_format',
        message: `Answer format must be one of ${ANSWER_FORMATS.join(', ')}.`,
      })
    } else if (rawAnswerFormat) {
      answerFormat = rawAnswerFormat as AnswerFormat
    }
    const isSingleChoice = answerFormat === 'single_choice'

    // -- Core content -------------------------------------------------------
    if (!row.questionText.trim()) {
      errors.push({ field: 'question_text', message: 'Question text is required.' })
    }

    // -- Per-option asset refs / explanations (JSON keyed by label) ---------
    const optionAssetRefsParsed = parseLabelKeyedJson(row.optionAssetRefsJson)
    if (optionAssetRefsParsed.invalid) {
      errors.push({
        field: 'option_asset_refs_json',
        message: 'option_asset_refs_json must be a JSON object keyed by option label (e.g. {"A": "a.svg"}).',
      })
    }
    const optionExplanationsParsed = parseLabelKeyedJson(row.optionExplanationsJson)
    if (optionExplanationsParsed.invalid) {
      errors.push({
        field: 'option_explanations_json',
        message: 'option_explanations_json must be a JSON object keyed by option label.',
      })
    }
    const optionAssetRefMap = optionAssetRefsParsed.map ?? {}
    const optionExplanationMap = optionExplanationsParsed.map ?? {}

    // -- Options (flexible A–E, subject-aware count rules) ------------------
    let optionTexts = row.options.map((option) => option.trim())

    if (isSingleChoice) {
      // Visual-only options: a label may have an asset ref instead of text —
      // pad the positional list so those labels count as real options.
      const assetLabelIndexes = Object.keys(optionAssetRefMap).map((label) =>
        (QUESTION_OPTION_LABELS as readonly string[]).indexOf(label)
      )
      const highestAssetIndex = Math.max(-1, ...assetLabelIndexes)
      while (optionTexts.length < highestAssetIndex + 1) {
        optionTexts.push('')
      }

      const optionLabels = labelsForCount(optionTexts.length)

      optionTexts.forEach((text, index) => {
        const label = optionLabels[index]
        if (!text && !(label && optionAssetRefMap[label])) {
          errors.push({
            field: `option_${label?.toLowerCase() ?? index + 1}`,
            message: `Option ${label ?? index + 1} is empty.`,
          })
        }
      })

      if (optionTexts.length === 0) {
        errors.push({ field: 'options', message: 'No answer options were parsed for this question.' })
      } else {
        const countCheck = checkOptionCount(subject?.name ?? row.subject, optionTexts.length, answerFormat)
        if (countCheck.error) {
          errors.push({ field: 'options', message: countCheck.error })
        } else if (countCheck.warning) {
          warnings.push({ field: 'options', message: countCheck.warning })
        }
      }

      const filledOptions = optionTexts.map((text) => text.toLowerCase()).filter(Boolean)
      if (new Set(filledOptions).size !== filledOptions.length) {
        errors.push({ field: 'options', message: 'Options must be unique within a question.' })
      }
    } else {
      if (optionTexts.some(Boolean) || Object.keys(optionAssetRefMap).length > 0) {
        errors.push({
          field: 'options',
          message: 'Extended response questions must not have answer options.',
        })
      }
      optionTexts = []
    }

    // -- Correct answer -------------------------------------------------------
    const correctOptionLabel = row.correctAnswer.trim().toUpperCase()
    if (isSingleChoice) {
      const optionLabels = labelsForCount(optionTexts.length)
      if (!correctOptionLabel) {
        errors.push({ field: 'correct_answer', message: 'Correct answer is required.' })
      } else if (!QUESTION_OPTION_LABELS.includes(correctOptionLabel as QuestionOptionLabel)) {
        errors.push({
          field: 'correct_answer',
          message: `Correct answer must be one of ${QUESTION_OPTION_LABELS.join(', ')}.`,
        })
      } else if (optionTexts.length > 0 && !optionLabels.includes(correctOptionLabel as QuestionOptionLabel)) {
        errors.push({
          field: 'correct_answer',
          message: `Correct answer is ${correctOptionLabel} but only ${optionLabels[0]}–${
            optionLabels[optionLabels.length - 1]
          } options were parsed.`,
        })
      }
    } else if (correctOptionLabel) {
      errors.push({
        field: 'correct_answer',
        message: 'Extended response questions must not have a correct answer letter.',
      })
    }

    const examType = normalizeExamType(row.examType)
    if (!row.examType.trim()) {
      errors.push({ field: 'exam_type', message: 'Exam type is required (OC or Selective).' })
    } else if (!examType) {
      errors.push({ field: 'exam_type', message: 'Exam type must be OC or Selective.' })
    }

    const difficulty = Number(row.difficulty)
    if (!row.difficulty.trim() || Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push({ field: 'difficulty', message: 'Difficulty must be a number from 1 to 5.' })
    }

    let yearLevel: number | null = null
    if (row.yearLevel.trim()) {
      const parsedYear = Number(row.yearLevel)
      if (Number.isNaN(parsedYear) || parsedYear < 3 || parsedYear > 12) {
        errors.push({ field: 'year_level', message: 'Year level must be between 3 and 12 when provided.' })
      } else {
        yearLevel = parsedYear
      }
    }

    let marks = 1
    if (row.marks.trim()) {
      const parsedMarks = Number(row.marks)
      if (!Number.isInteger(parsedMarks) || parsedMarks < 1) {
        errors.push({ field: 'marks', message: 'Marks must be a positive whole number when provided.' })
      } else {
        marks = parsedMarks
      }
    }

    let timeLimitSeconds: number | null = null
    if (row.timeLimitSeconds.trim()) {
      const parsedTimeLimit = Number(row.timeLimitSeconds)
      if (!Number.isInteger(parsedTimeLimit) || parsedTimeLimit < 1) {
        errors.push({
          field: 'time_limit_seconds',
          message: 'Time limit must be a positive whole number of seconds when provided.',
        })
      } else {
        timeLimitSeconds = parsedTimeLimit
      }
    }

    // -- Rubric (required for extended response) -----------------------------
    const { rubric, error: rubricError } = parseWritingRubric(row.rubricJson)
    if (!isSingleChoice && !row.rubricJson.trim()) {
      errors.push({
        field: 'rubric_json',
        message: 'Extended response questions need a rubric_json with at least one marking criterion.',
      })
    } else if (rubricError) {
      errors.push({ field: 'rubric_json', message: rubricError })
    }

    // -- Worked solution (soft for MCQ, optional for extended response) -----
    const workedSolution = row.workedSolution.trim()
    if (isSingleChoice && !workedSolution) {
      warnings.push({ field: 'solution', message: 'No worked solution — students will not see a full explanation.' })
    }

    // -- Short explanation (optional unless required; derive when missing) --
    let shortExplanation = row.shortExplanation.trim() || null
    if (!shortExplanation) {
      if (settings.requireShortExplanation) {
        errors.push({ field: 'short_explanation', message: 'A short explanation is required.' })
      } else if (isSingleChoice) {
        shortExplanation = deriveShortExplanation(workedSolution)
        warnings.push({
          field: 'short_explanation',
          message: shortExplanation
            ? 'No short explanation — derived a summary from the worked solution.'
            : 'No short explanation provided.',
        })
      }
    }

    // -- Stimulus (grouped by external ref; definition may be on any row) ---
    const stimulusExternalRef = row.stimulusId.trim() || null
    let stimulusDefinition: ResolvedImportStimulus | null = null
    if (stimulusExternalRef) {
      const group = stimulusGroups.get(stimulusExternalRef)
      const existsInDb = maps.existingStimulusRefs.has(stimulusExternalRef)

      if (group?.hasDefinition && existsInDb) {
        warnings.push({
          field: 'stimulus_id',
          message: `Stimulus "${stimulusExternalRef}" already exists in the bank — the existing stimulus will be reused and the CSV stimulus text ignored.`,
        })
      } else if (group?.hasDefinition) {
        const stimulusType = normalizeStimulusType(group.stimulusType)
        if (!stimulusType) {
          errors.push({
            field: 'stimulus_type',
            message: group.stimulusType
              ? `Stimulus type "${group.stimulusType}" must be one of ${STIMULUS_TYPES.join(', ')}.`
              : `Stimulus "${stimulusExternalRef}" needs a stimulus_type (${STIMULUS_TYPES.join(', ')}).`,
          })
        } else {
          stimulusDefinition = {
            externalRef: stimulusExternalRef,
            title: group.title || stimulusExternalRef,
            stimulusType,
            bodyMarkdown: group.bodyMarkdown || null,
            assetRefs: group.assetRefs,
          }
        }
      } else if (!existsInDb) {
        errors.push({
          field: 'stimulus_id',
          message: `Stimulus "${stimulusExternalRef}" is not defined in this file and was not found in the bank.`,
        })
      }
    }

    // -- Presentation hints ---------------------------------------------------
    const presentation: QuestionPresentation = {}
    if (row.inputMethod.trim()) {
      presentation.inputMethod = row.inputMethod.trim()
    }
    if (row.displayMode.trim()) {
      presentation.displayMode = row.displayMode.trim()
    }
    if (row.answerValidationJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(row.answerValidationJson)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('not an object')
        }
        presentation.answerValidation = parsed as Record<string, unknown>
      } catch {
        errors.push({
          field: 'answer_validation_json',
          message: 'answer_validation_json must be a JSON object.',
        })
      }
    }

    // -- Provenance -----------------------------------------------------------
    const sourceInfo: QuestionSourceInfo = {}
    if (row.sourceName.trim()) sourceInfo.sourceName = row.sourceName.trim()
    if (row.sourcePaper.trim()) sourceInfo.sourcePaper = row.sourcePaper.trim()
    if (row.sourceSection.trim()) sourceInfo.sourceSection = row.sourceSection.trim()
    if (row.sourceQuestionNumber.trim()) sourceInfo.sourceQuestionNumber = row.sourceQuestionNumber.trim()
    if (row.licenseNotes.trim()) sourceInfo.licenseNotes = row.licenseNotes.trim()

    // -- Tags (soft: brand-new tags are a heads-up, never blocking) ---------
    const tags = parseTags(row.tags)
    const skillTags = parseTags(row.skillTags)
    const conceptTags = parseTags(row.conceptTags)
    const newTags = tags.filter((tag) => !maps.existingTags.has(tag.toLowerCase()))
    if (newTags.length > 0) {
      warnings.push({ field: 'tags', message: `New tag${newTags.length === 1 ? '' : 's'}: ${newTags.join(', ')}.` })
    }

    // -- Status -------------------------------------------------------------
    const rawStatus = row.status.trim().toLowerCase()
    if (rawStatus && !QUESTION_STATUSES.includes(rawStatus as QuestionStatus)) {
      warnings.push({ field: 'status', message: `Unknown status "${row.status}" ignored.` })
    }
    // Import status is an admin setting, applied uniformly.
    const resolvedStatus: QuestionStatus = settings.importStatus

    // -- Duplicate detection ------------------------------------------------
    const normalizedText = normalizeQuestionText(row.questionText)
    let isDuplicate = false
    if (normalizedText) {
      if (seenInFile.has(normalizedText)) {
        errors.push({ field: 'question_text', message: 'This question is duplicated within the import.' })
      } else {
        seenInFile.add(normalizedText)
      }
      if (existingTextSet.has(normalizedText)) {
        isDuplicate = true
        const message = 'A very similar question already exists in the bank.'
        if (settings.blockDuplicates) {
          errors.push({ field: 'question_text', message: `${message} Duplicates are set to block.` })
        } else {
          warnings.push({ field: 'question_text', message: `${message} Importing anyway (duplicates set to warn).` })
        }
      }
    }

    const externalId = row.externalId.trim() || null
    if (externalId) {
      if (seenExternalIds.has(externalId)) {
        errors.push({ field: 'external_id', message: `external_id "${externalId}" is duplicated within the import.` })
      } else {
        seenExternalIds.add(externalId)
      }
      if (maps.existingExternalIds.has(externalId)) {
        isDuplicate = true
        const message = `A question with external_id "${externalId}" already exists in the bank.`
        if (settings.blockDuplicates) {
          errors.push({ field: 'external_id', message: `${message} Duplicates are set to block.` })
        } else {
          warnings.push({ field: 'external_id', message: `${message} It will be skipped at import time.` })
        }
      }
    }

    const isImportable = errors.length === 0

    const optionLabels = labelsForCount(optionTexts.length)
    const resolved: ResolvedImportQuestion | null =
      isImportable && subject && examType
        ? {
            externalId,
            subjectId: subject.id,
            topicId,
            topicName,
            strand: row.strand.trim() || null,
            questionTypeId,
            questionTypeName,
            variantId,
            variantName,
            examType,
            difficulty,
            yearLevel,
            marks,
            timeLimitSeconds,
            answerFormat,
            questionText: row.questionText.trim(),
            passageText: row.passageText.trim() || null,
            options: optionTexts,
            optionAssetRefs: optionLabels.map((label) => optionAssetRefMap[label] ?? null),
            optionExplanations: optionLabels.map((label) => optionExplanationMap[label] ?? null),
            correctOptionLabel: isSingleChoice ? (correctOptionLabel as QuestionOptionLabel) : null,
            workedSolution,
            shortExplanation,
            stimulusExternalRef,
            stimulusDefinition,
            questionAssetRefs: row.questionAssetRefs,
            solutionAssetRefs: row.solutionAssetRefs,
            rubric,
            presentation,
            sourceInfo,
            assetGenerationPrompt: row.assetGenerationPrompt.trim() || null,
            assetAltText: row.assetAltText.trim() || null,
            assetSpec: parseAssetSpec(row.assetSpecJson),
            assetStatus: parseAssetStatus(row.assetStatus),
            tags,
            skillTags,
            conceptTags,
            status: resolvedStatus,
          }
        : null

    const rowStatus = !isImportable ? 'error' : warnings.length > 0 ? 'warning' : 'ready'

    validatedRows.push({
      rowNumber: row.rowNumber,
      rowStatus,
      questionPreview: row.questionText.trim() || '(missing question text)',
      subjectLabel: subject?.name ?? (row.subject || '—'),
      topicLabel: topicName || '—',
      questionTypeLabel: questionTypeName ?? 'Untagged',
      statusLabel: resolvedStatus,
      optionsCount: optionTexts.length,
      correctAnswerLabel: correctOptionLabel || '—',
      errors,
      warnings,
      isDuplicate,
      isImportable,
      resolved,
    })
  }

  return {
    format: options.format,
    totalRows: validatedRows.length,
    importableCount: validatedRows.filter((row) => row.isImportable).length,
    readyCount: validatedRows.filter((row) => row.rowStatus === 'ready').length,
    warningCount: validatedRows.filter((row) => row.warnings.length > 0).length,
    errorCount: validatedRows.filter((row) => !row.isImportable).length,
    duplicateCount: validatedRows.filter((row) => row.isDuplicate).length,
    rows: validatedRows,
  }
}
