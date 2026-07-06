import { parseTags } from '@/lib/questions/mutations'
import { checkOptionCount, labelsForCount } from '@/lib/questions/option-rules'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  QUESTION_STATUSES,
  type ExamType,
  type QuestionOptionLabel,
  type QuestionStatus,
} from '@/lib/types'
import type {
  ImportFormat,
  ImportReference,
  ImportRowIssue,
  ImportSettings,
  ImportValidationResult,
  QuestionImportRow,
  ResolvedImportQuestion,
  ValidatedImportRow,
} from '@/lib/import/types'

export function normalizeQuestionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeExamType(value: string): ExamType | null {
  const match = EXAM_TYPES.find((exam) => exam.toLowerCase() === value.trim().toLowerCase())
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

interface ReferenceMaps {
  subjectByKey: Map<string, ImportReference['subjects'][number]>
  topicByKey: Map<string, ImportReference['topics'][number]>
  questionTypeByKey: Map<string, ImportReference['questionTypes'][number]>
  existingTags: Set<string>
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

  return {
    subjectByKey,
    topicByKey,
    questionTypeByKey,
    existingTags: new Set(reference.existingTags.map((tag) => tag.trim().toLowerCase())),
  }
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
  const existingTextSet = new Set(options.existingQuestionTexts.map(normalizeQuestionText))
  const seenInFile = new Set<string>()
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

    // -- Core content -------------------------------------------------------
    if (!row.questionText.trim()) {
      errors.push({ field: 'question_text', message: 'Question text is required.' })
    }

    // -- Options (flexible A–E, subject-aware count rules) ------------------
    const optionTexts = row.options.map((option) => option.trim())
    const optionLabels = labelsForCount(optionTexts.length)

    optionTexts.forEach((text, index) => {
      if (!text) {
        errors.push({
          field: `option_${optionLabels[index]?.toLowerCase() ?? index + 1}`,
          message: `Option ${optionLabels[index] ?? index + 1} is empty.`,
        })
      }
    })

    if (optionTexts.length === 0) {
      errors.push({ field: 'options', message: 'No answer options were parsed for this question.' })
    } else {
      const countCheck = checkOptionCount(subject?.name ?? row.subject, optionTexts.length)
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

    const correctOptionLabel = row.correctAnswer.trim().toUpperCase()
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

    // -- Worked solution (soft: recommended, stored empty if absent) --------
    const workedSolution = row.workedSolution.trim()
    if (!workedSolution) {
      warnings.push({ field: 'solution', message: 'No worked solution — students will not see a full explanation.' })
    }

    // -- Short explanation (optional unless required; derive when missing) --
    let shortExplanation = row.shortExplanation.trim() || null
    if (!shortExplanation) {
      if (settings.requireShortExplanation) {
        errors.push({ field: 'short_explanation', message: 'A short explanation is required.' })
      } else {
        shortExplanation = deriveShortExplanation(workedSolution)
        warnings.push({
          field: 'short_explanation',
          message: shortExplanation
            ? 'No short explanation — derived a summary from the worked solution.'
            : 'No short explanation provided.',
        })
      }
    }

    // -- Tags (soft: brand-new tags are a heads-up, never blocking) ---------
    const tags = parseTags(row.tags)
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

    const isImportable = errors.length === 0

    const resolved: ResolvedImportQuestion | null =
      isImportable && subject && examType
        ? {
            subjectId: subject.id,
            topicId,
            topicName,
            questionTypeId,
            questionTypeName,
            examType,
            difficulty,
            yearLevel,
            questionText: row.questionText.trim(),
            passageText: row.passageText.trim() || null,
            options: optionTexts,
            correctOptionLabel: correctOptionLabel as QuestionOptionLabel,
            workedSolution,
            shortExplanation,
            tags,
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
