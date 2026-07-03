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
  ImportStatusMode,
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

interface ReferenceMaps {
  subjectByKey: Map<string, ImportReference['subjects'][number]>
  topicByKey: Map<string, ImportReference['topics'][number]>
  questionTypeByKey: Map<string, ImportReference['questionTypes'][number]>
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

  return { subjectByKey, topicByKey, questionTypeByKey }
}

interface ValidateOptions {
  format: ImportFormat
  reference: ImportReference
  existingQuestionTexts: string[]
  statusMode: ImportStatusMode
}

export function validateQuestionImportRows(
  rows: QuestionImportRow[],
  options: ValidateOptions
): ImportValidationResult {
  const maps = buildReferenceMaps(options.reference)
  const existingTextSet = new Set(options.existingQuestionTexts.map(normalizeQuestionText))
  const seenInFile = new Set<string>()
  const validatedRows: ValidatedImportRow[] = []

  for (const row of rows) {
    const errors: ImportRowIssue[] = []
    const warnings: ImportRowIssue[] = []

    // Taxonomy resolution (name or slug).
    const subject = row.subject ? maps.subjectByKey.get(row.subject.trim().toLowerCase()) ?? null : null
    if (!row.subject) {
      errors.push({ field: 'subject', message: 'Subject is required.' })
    } else if (!subject) {
      errors.push({ field: 'subject', message: `Subject "${row.subject}" was not found.` })
    }

    const topic =
      subject && row.topic
        ? maps.topicByKey.get(`${subject.id}:${row.topic.trim().toLowerCase()}`) ?? null
        : null
    if (!row.topic) {
      errors.push({ field: 'topic', message: 'Topic is required.' })
    } else if (subject && !topic) {
      errors.push({ field: 'topic', message: `Topic "${row.topic}" was not found under ${subject.name}.` })
    }

    const questionType =
      subject && row.questionType
        ? maps.questionTypeByKey.get(`${subject.id}:${row.questionType.trim().toLowerCase()}`) ?? null
        : null
    if (row.questionType && subject && !questionType) {
      errors.push({
        field: 'question_type',
        message: `Question type "${row.questionType}" was not found for ${subject.name}.`,
      })
    }

    // Core content.
    if (!row.questionText.trim()) {
      errors.push({ field: 'question_text', message: 'Question text is required.' })
    }
    if (!row.workedSolution.trim()) {
      errors.push({ field: 'solution', message: 'A worked solution is required.' })
    }

    const optionValues = { A: row.optionA, B: row.optionB, C: row.optionC, D: row.optionD }
    for (const label of QUESTION_OPTION_LABELS) {
      if (!optionValues[label].trim()) {
        errors.push({ field: `option_${label.toLowerCase()}`, message: `Option ${label} is required.` })
      }
    }
    const filledOptions = QUESTION_OPTION_LABELS.map((label) => optionValues[label].trim().toLowerCase()).filter(
      Boolean
    )
    if (new Set(filledOptions).size !== filledOptions.length) {
      errors.push({ field: 'options', message: 'Options must be unique within a question.' })
    }

    const correctOptionLabel = row.correctAnswer.trim().toUpperCase()
    if (!QUESTION_OPTION_LABELS.includes(correctOptionLabel as QuestionOptionLabel)) {
      errors.push({ field: 'correct_answer', message: 'Correct answer must be A, B, C, or D.' })
    }

    const examType = normalizeExamType(row.examType)
    if (!examType) {
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

    const rawStatus = row.status.trim().toLowerCase()
    if (rawStatus && !QUESTION_STATUSES.includes(rawStatus as QuestionStatus)) {
      errors.push({ field: 'status', message: 'Status must be draft, published, or archived.' })
    }
    const resolvedStatus: QuestionStatus =
      options.statusMode === 'draft'
        ? 'draft'
        : rawStatus && QUESTION_STATUSES.includes(rawStatus as QuestionStatus)
          ? (rawStatus as QuestionStatus)
          : 'draft'

    if (!row.shortExplanation.trim()) {
      warnings.push({ field: 'short_explanation', message: 'Short explanation is recommended for faster feedback.' })
    }

    // Duplicate detection.
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
        warnings.push({ field: 'question_text', message: 'A very similar question already exists and will be skipped.' })
      }
    }

    const isImportable = errors.length === 0 && !isDuplicate

    const resolved: ResolvedImportQuestion | null =
      isImportable && subject && topic && examType
        ? {
            subjectId: subject.id,
            topicId: topic.id,
            questionTypeId: questionType?.id ?? null,
            examType,
            difficulty,
            yearLevel,
            questionText: row.questionText.trim(),
            passageText: row.passageText.trim() || null,
            optionA: row.optionA.trim(),
            optionB: row.optionB.trim(),
            optionC: row.optionC.trim(),
            optionD: row.optionD.trim(),
            correctOptionLabel: correctOptionLabel as QuestionOptionLabel,
            workedSolution: row.workedSolution.trim(),
            shortExplanation: row.shortExplanation.trim() || null,
            status: resolvedStatus,
          }
        : null

    validatedRows.push({
      rowNumber: row.rowNumber,
      questionPreview: row.questionText.trim() || '(missing question text)',
      subjectLabel: subject?.name ?? (row.subject || '—'),
      topicLabel: topic?.name ?? (row.topic || '—'),
      questionTypeLabel: questionType?.name ?? (row.questionType || 'Untagged'),
      statusLabel: resolvedStatus,
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
    readyCount: validatedRows.filter((row) => row.isImportable).length,
    warningCount: validatedRows.filter((row) => row.warnings.length > 0).length,
    errorCount: validatedRows.filter((row) => row.errors.length > 0).length,
    duplicateCount: validatedRows.filter((row) => row.isDuplicate).length,
    rows: validatedRows,
  }
}
