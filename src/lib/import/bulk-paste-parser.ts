import type { QuestionImportRow } from '@/lib/import/types'

export interface BulkPasteParseResult {
  rows: QuestionImportRow[]
  error?: string
}

const OPTION_RE = /^\s*([A-D])[.)]\s*(.+)$/i
const LABEL_RE = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/
const QUESTION_START_RE = /^\s*(?:q|question)\s*\d*\s*[.):-]/i

function emptyRow(rowNumber: number): QuestionImportRow {
  return {
    rowNumber,
    subject: '',
    topic: '',
    questionType: '',
    difficulty: '',
    examType: '',
    questionText: '',
    passageText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    workedSolution: '',
    shortExplanation: '',
    status: '',
    tags: '',
    yearLevel: '',
  }
}

function splitIntoBlocks(text: string): string[] {
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (QUESTION_START_RE.test(line) && current.some((entry) => entry.trim())) {
      blocks.push(current.join('\n'))
      current = []
    }
    current.push(line)
  }
  if (current.some((entry) => entry.trim())) {
    blocks.push(current.join('\n'))
  }

  // Fallback: if we could not detect explicit "Q1." markers, split on blank lines.
  if (blocks.length <= 1) {
    const byBlankLine = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
    if (byBlankLine.length > 1) {
      return byBlankLine
    }
  }

  return blocks.filter((block) => block.trim())
}

function parseBlock(block: string, rowNumber: number): QuestionImportRow {
  const row = emptyRow(rowNumber)
  const questionParts: string[] = []
  let sawOption = false
  let collectingSolution = false

  for (const line of block.split('\n')) {
    const optionMatch = line.match(OPTION_RE)
    if (optionMatch) {
      sawOption = true
      collectingSolution = false
      const label = optionMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
      row[`option${label}`] = optionMatch[2].trim()
      continue
    }

    const labelMatch = line.match(LABEL_RE)
    if (labelMatch) {
      const key = labelMatch[1].trim().toLowerCase()
      const value = labelMatch[2].trim()
      collectingSolution = false

      switch (key) {
        case 'answer':
        case 'correct answer':
          row.correctAnswer = value
          break
        case 'solution':
        case 'worked solution':
          row.workedSolution = value
          collectingSolution = true
          break
        case 'subject':
          row.subject = value
          break
        case 'topic':
          row.topic = value
          break
        case 'question type':
        case 'type':
          row.questionType = value
          break
        case 'difficulty':
          row.difficulty = value
          break
        case 'exam type':
        case 'exam':
          row.examType = value
          break
        case 'short explanation':
        case 'explanation':
          row.shortExplanation = value
          break
        case 'passage':
        case 'passage text':
          row.passageText = value
          break
        case 'status':
          row.status = value
          break
        case 'tags':
          row.tags = value
          break
        case 'year':
        case 'year level':
          row.yearLevel = value
          break
        default:
          // Unrecognised "Label: value" line — treat as question text only before options appear.
          if (!sawOption) {
            questionParts.push(line)
          }
      }
      continue
    }

    if (collectingSolution) {
      row.workedSolution += `\n${line.trim()}`
      continue
    }

    if (!sawOption) {
      questionParts.push(line)
    }
  }

  row.questionText = questionParts
    .join(' ')
    .replace(QUESTION_START_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
  row.workedSolution = row.workedSolution.trim()

  return row
}

export function parseBulkPasteQuestions(text: string): BulkPasteParseResult {
  const normalized = text.replace(/\r\n/g, '\n').trim()

  if (!normalized) {
    return { rows: [], error: 'Paste at least one question before previewing.' }
  }

  const blocks = splitIntoBlocks(normalized)

  if (blocks.length === 0) {
    return { rows: [], error: 'No questions were detected in the pasted text.' }
  }

  return { rows: blocks.map((block, index) => parseBlock(block, index + 1)) }
}
