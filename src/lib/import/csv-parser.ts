import { parseCsvText } from '@/lib/csv/parse'
import type { QuestionImportRow } from '@/lib/import/types'

type ColumnKey = keyof Omit<QuestionImportRow, 'rowNumber'>

// Accept both the user-friendly headers and the slug-based headers.
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  subject: ['subject', 'subject_slug', 'subject_name'],
  topic: ['topic', 'topic_slug', 'topic_name'],
  questionType: ['question_type', 'question_type_slug', 'question_type_name', 'type'],
  difficulty: ['difficulty'],
  examType: ['exam_type', 'exam'],
  questionText: ['question_text', 'question'],
  passageText: ['passage_text', 'passage'],
  optionA: ['option_a', 'a'],
  optionB: ['option_b', 'b'],
  optionC: ['option_c', 'c'],
  optionD: ['option_d', 'd'],
  correctAnswer: ['correct_answer', 'correct_option_label', 'answer', 'correct'],
  workedSolution: ['solution', 'worked_solution'],
  shortExplanation: ['short_explanation', 'explanation'],
  status: ['status'],
  tags: ['tags'],
  yearLevel: ['year_level', 'year'],
}

function normalizeHeader(value: string): string {
  return value.replace(/^﻿/, '').trim().toLowerCase()
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
  const columnIndex = {} as Record<ColumnKey, number>

  for (const key of Object.keys(HEADER_ALIASES) as ColumnKey[]) {
    columnIndex[key] = HEADER_ALIASES[key].reduce((found, alias) => {
      if (found !== -1) return found
      return headers.indexOf(alias)
    }, -1)
  }

  if (columnIndex.questionText === -1) {
    return { rows: [], error: 'The CSV must include a "question_text" (or "question") column.' }
  }

  const rows: QuestionImportRow[] = []

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index]
    const get = (key: ColumnKey): string => {
      const at = columnIndex[key]
      return at === -1 ? '' : (cells[at] ?? '').trim()
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
      optionA: get('optionA'),
      optionB: get('optionB'),
      optionC: get('optionC'),
      optionD: get('optionD'),
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
