import { parseCsvText } from '@/lib/csv/parse'
import { QUESTION_OPTION_LABELS } from '@/lib/types'
import type { QuestionImportRow } from '@/lib/import/types'

type ScalarColumnKey = keyof Omit<QuestionImportRow, 'rowNumber' | 'options'>

// Accept both the user-friendly headers and the slug-based headers.
const HEADER_ALIASES: Record<ScalarColumnKey, string[]> = {
  subject: ['subject', 'subject_slug', 'subject_name'],
  topic: ['topic', 'topic_slug', 'topic_name'],
  questionType: ['question_type', 'question_type_slug', 'question_type_name', 'type'],
  difficulty: ['difficulty'],
  examType: ['exam_type', 'exam'],
  questionText: ['question_text', 'question'],
  passageText: ['passage_text', 'passage'],
  correctAnswer: ['correct_answer', 'correct_option_label', 'answer', 'correct'],
  workedSolution: ['solution', 'worked_solution'],
  shortExplanation: ['short_explanation', 'explanation'],
  status: ['status'],
  tags: ['tags'],
  yearLevel: ['year_level', 'year'],
}

// option_a..option_e (or bare a..e). option_e may be blank for 4-option subjects.
const OPTION_HEADER_ALIASES = QUESTION_OPTION_LABELS.map((label) => [
  `option_${label.toLowerCase()}`,
  label.toLowerCase(),
])

// A single JSON column can replace the option_* columns entirely.
const OPTIONS_JSON_ALIASES = ['options_json', 'options']

function normalizeHeader(value: string): string {
  return value.replace(/^﻿/, '').trim().toLowerCase()
}

/**
 * Parses an options_json cell. Accepts either an array of strings
 * (["60", "75"]) or an array of {key/label, text/option_text} objects.
 * Returns null when the cell isn't valid JSON of either shape.
 */
export function parseOptionsJson(cell: string): string[] | null {
  if (!cell.trim()) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(cell)
    if (!Array.isArray(parsed)) {
      return null
    }

    const texts: string[] = []
    for (const entry of parsed) {
      if (typeof entry === 'string') {
        texts.push(entry.trim())
        continue
      }
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>
        const text = record.text ?? record.option_text ?? record.value
        if (typeof text === 'string') {
          texts.push(text.trim())
          continue
        }
      }
      return null
    }
    return texts
  } catch {
    return null
  }
}

/** Drops empty trailing option cells (e.g. a blank option_e) while keeping interior gaps visible. */
function trimTrailingEmpty(options: string[]): string[] {
  const trimmed = [...options]
  while (trimmed.length > 0 && !trimmed[trimmed.length - 1].trim()) {
    trimmed.pop()
  }
  return trimmed
}

export interface CsvParseResult {
  rows: QuestionImportRow[]
  error?: string
}

export function parseCsvQuestions(text: string): CsvParseResult {
  const table = parseCsvText(text)

  if (table.length < 2) {
    return { rows: [], error: 'The CSV needs a header row and at least one question row.' }
  }

  const headers = table[0].map(normalizeHeader)
  const columnIndex = {} as Record<ScalarColumnKey, number>

  for (const key of Object.keys(HEADER_ALIASES) as ScalarColumnKey[]) {
    columnIndex[key] = HEADER_ALIASES[key].reduce((found, alias) => {
      if (found !== -1) return found
      return headers.indexOf(alias)
    }, -1)
  }

  const optionIndexes = OPTION_HEADER_ALIASES.map((aliases) =>
    aliases.reduce((found, alias) => (found !== -1 ? found : headers.indexOf(alias)), -1)
  )
  const optionsJsonIndex = OPTIONS_JSON_ALIASES.reduce(
    (found, alias) => (found !== -1 ? found : headers.indexOf(alias)),
    -1
  )

  if (columnIndex.questionText === -1) {
    return { rows: [], error: 'The CSV must include a "question_text" (or "question") column.' }
  }

  if (optionsJsonIndex === -1 && optionIndexes.every((index) => index === -1)) {
    return {
      rows: [],
      error: 'The CSV must include option columns (option_a … option_e) or an options_json column.',
    }
  }

  const rows: QuestionImportRow[] = []

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index]
    const get = (key: ScalarColumnKey): string => {
      const at = columnIndex[key]
      return at === -1 ? '' : (cells[at] ?? '').trim()
    }

    // Prefer options_json when present and valid; otherwise read option_a..e.
    let options: string[] | null = null
    if (optionsJsonIndex !== -1) {
      options = parseOptionsJson((cells[optionsJsonIndex] ?? '').trim())
    }
    if (options === null) {
      options = optionIndexes.map((at) => (at === -1 ? '' : (cells[at] ?? '').trim()))
    }

    rows.push({
      rowNumber: index + 1,
      subject: get('subject'),
      topic: get('topic'),
      questionType: get('questionType'),
      difficulty: get('difficulty'),
      examType: get('examType'),
      questionText: get('questionText'),
      passageText: get('passageText'),
      options: trimTrailingEmpty(options),
      correctAnswer: get('correctAnswer'),
      workedSolution: get('workedSolution'),
      shortExplanation: get('shortExplanation'),
      status: get('status'),
      tags: get('tags'),
      yearLevel: get('yearLevel'),
    })
  }

  return { rows }
}
