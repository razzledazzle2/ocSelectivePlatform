import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '@/lib/csv/parse'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  QUESTION_STATUSES,
  type CsvImportableQuestion,
  type CsvQuestionRowPreview,
  type CsvRowError,
  type QuestionCsvPreviewResult,
  type QuestionOptionLabel,
  type QuestionStatus,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

const CSV_COLUMNS = [
  'exam_type',
  'year_level',
  'subject_slug',
  'topic_slug',
  'question_type_slug',
  'difficulty',
  'question_text',
  'passage_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option_label',
  'short_explanation',
  'worked_solution',
  'status',
] as const

interface CsvReferenceData {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function normalizeQuestionKey(questionText: string): string {
  return questionText.replace(/\s+/g, ' ').trim().toLowerCase()
}

function createRowPreview(
  rowNumber: number,
  values: Record<(typeof CSV_COLUMNS)[number], string>,
  errors: CsvRowError[]
): CsvQuestionRowPreview {
  return {
    rowNumber,
    examType: values.exam_type,
    yearLevel: values.year_level,
    subjectSlug: values.subject_slug,
    topicSlug: values.topic_slug,
    questionTypeSlug: values.question_type_slug,
    difficulty: values.difficulty,
    questionText: values.question_text,
    passageText: values.passage_text,
    optionA: values.option_a,
    optionB: values.option_b,
    optionC: values.option_c,
    optionD: values.option_d,
    correctOptionLabel: values.correct_option_label,
    shortExplanation: values.short_explanation,
    workedSolution: values.worked_solution,
    status: values.status,
    errors,
  }
}

async function loadReferenceData(): Promise<CsvReferenceData> {
  const supabase = createClient()
  const [{ data: subjects, error: subjectsError }, { data: topics, error: topicsError }, { data: questionTypes, error: questionTypesError }] =
    await Promise.all([
      supabase
        .from('subjects')
        .select('id, name, slug, description, sort_order, is_active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('topics')
        .select('id, subject_id, name, slug, description, sort_order, is_active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('question_types')
        .select('id, subject_id, topic_id, name, slug, description, sort_order, is_active')
        .order('sort_order', { ascending: true }),
    ])

  if (subjectsError || topicsError || questionTypesError) {
    throw new Error('Unable to load question taxonomy for CSV validation.')
  }

  return {
    subjects: (subjects ?? []) as SubjectRecord[],
    topics: (topics ?? []) as TopicRecord[],
    questionTypes: (questionTypes ?? []) as QuestionTypeRecord[],
  }
}

function buildRowValues(headers: string[], row: string[]): Record<(typeof CSV_COLUMNS)[number], string> {
  const values = {} as Record<(typeof CSV_COLUMNS)[number], string>

  for (const column of CSV_COLUMNS) {
    const columnIndex = headers.indexOf(column)
    values[column] = (row[columnIndex] ?? '').trim()
  }

  return values
}

function validateHeader(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader)
  const missingColumns = CSV_COLUMNS.filter((column) => !normalizedHeaders.includes(column))

  if (missingColumns.length > 0) {
    throw new Error(
      `The CSV is missing required columns: ${missingColumns.join(', ')}.`
    )
  }

  return normalizedHeaders
}

export async function validateQuestionCsvText(
  text: string,
  fileName: string
): Promise<QuestionCsvPreviewResult> {
  const rows = parseCsvText(text)

  if (rows.length < 2) {
    throw new Error('The CSV must include a header row and at least one question row.')
  }

  const headers = validateHeader(rows[0])
  const { subjects, topics, questionTypes } = await loadReferenceData()
  const subjectMap = new Map(subjects.map((subject) => [subject.slug, subject]))
  const topicMap = new Map(
    topics.map((topic) => [`${topic.subject_id}:${topic.slug}`, topic])
  )
  const questionTypeMap = new Map(
    questionTypes.map((questionType) => [
      `${questionType.subject_id}:${questionType.slug}`,
      questionType,
    ])
  )
  const previewRows: CsvQuestionRowPreview[] = []
  const validRows: CsvImportableQuestion[] = []
  const fileDuplicateKeys = new Set<string>()

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1
    const values = buildRowValues(headers, rows[index])
    const errors: CsvRowError[] = []
    const examType = values.exam_type
    const yearLevel = values.year_level ? Number(values.year_level) : null
    const difficulty = Number(values.difficulty)
    const correctOptionLabel = values.correct_option_label.toUpperCase()
    const status = values.status.toLowerCase()
    const subject = subjectMap.get(values.subject_slug)

    if (!EXAM_TYPES.includes(examType as (typeof EXAM_TYPES)[number])) {
      errors.push({ field: 'exam_type', message: 'Must be OC or Selective.' })
    }

    if (values.year_level && (Number.isNaN(yearLevel) || yearLevel < 3 || yearLevel > 12)) {
      errors.push({ field: 'year_level', message: 'Must be between 3 and 12 when provided.' })
    }

    if (Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push({ field: 'difficulty', message: 'Must be a number from 1 to 5.' })
    }

    if (!values.question_text) {
      errors.push({ field: 'question_text', message: 'Question text is required.' })
    }

    if (!values.worked_solution) {
      errors.push({ field: 'worked_solution', message: 'Worked solution is required.' })
    }

    for (const label of QUESTION_OPTION_LABELS) {
      const field = `option_${label.toLowerCase()}` as const

      if (!values[field]) {
        errors.push({ field, message: `Option ${label} is required.` })
      }
    }

    if (!QUESTION_OPTION_LABELS.includes(correctOptionLabel as QuestionOptionLabel)) {
      errors.push({ field: 'correct_option_label', message: 'Must be A, B, C, or D.' })
    }

    if (!QUESTION_STATUSES.includes(status as QuestionStatus)) {
      errors.push({ field: 'status', message: 'Must be draft, published, or archived.' })
    }

    if (!subject) {
      errors.push({ field: 'subject_slug', message: 'Must match an existing subject.' })
    }

    const topic = subject ? topicMap.get(`${subject.id}:${values.topic_slug}`) : null

    if (!topic) {
      errors.push({
        field: 'topic_slug',
        message: 'Must match an existing topic under the selected subject.',
      })
    }

    const questionType =
      subject && values.question_type_slug
        ? questionTypeMap.get(`${subject.id}:${values.question_type_slug}`) ?? null
        : null

    if (values.question_type_slug && !questionType) {
      errors.push({
        field: 'question_type_slug',
        message: 'Must match an existing question type for the subject when provided.',
      })
    }

    const duplicateKey = [
      examType,
      values.subject_slug,
      values.topic_slug,
      normalizeQuestionKey(values.question_text),
    ].join('|')

    if (fileDuplicateKeys.has(duplicateKey)) {
      errors.push({
        field: 'question_text',
        message: 'This question appears more than once in the uploaded CSV.',
      })
    } else if (values.question_text) {
      fileDuplicateKeys.add(duplicateKey)
    }

    previewRows.push(createRowPreview(rowNumber, values, errors))

    if (errors.length > 0 || !subject || !topic) {
      continue
    }

    validRows.push({
      rowNumber,
      examType: examType as CsvImportableQuestion['examType'],
      yearLevel,
      subjectId: subject.id,
      subjectSlug: subject.slug,
      topicId: topic.id,
      topicSlug: topic.slug,
      questionTypeId: questionType?.id ?? null,
      questionTypeSlug: values.question_type_slug,
      difficulty,
      questionText: values.question_text,
      passageText: values.passage_text || null,
      optionA: values.option_a,
      optionB: values.option_b,
      optionC: values.option_c,
      optionD: values.option_d,
      correctOptionLabel: correctOptionLabel as QuestionOptionLabel,
      shortExplanation: values.short_explanation || null,
      workedSolution: values.worked_solution,
      status: status as CsvImportableQuestion['status'],
    })
  }

  return {
    fileName,
    totalRows: rows.length - 1,
    validRows,
    previewRows,
  }
}
