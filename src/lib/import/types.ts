import type {
  ExamType,
  QuestionOptionLabel,
  QuestionSource,
  QuestionStatus,
  SubjectRecord,
  TopicRecord,
  QuestionTypeRecord,
} from '@/lib/types'

export type ImportFormat = 'csv' | 'paste'

/** Maps an import format to the questions.source value it produces. */
export const IMPORT_FORMAT_SOURCE: Record<ImportFormat, QuestionSource> = {
  csv: 'csv',
  paste: 'bulk_paste',
}

/** 'draft' forces every row to draft; 'source' respects the parsed status (defaulting to draft). */
export type ImportStatusMode = 'draft' | 'source'

/**
 * The common internal shape every importer (CSV, bulk paste, and later AI drafts) produces.
 * Fields are raw strings straight from the source; validation resolves and normalises them.
 * Options are positional (index 0 = A, 1 = B, ...) and support 4 or 5 entries.
 */
export interface QuestionImportRow {
  rowNumber: number
  subject: string
  topic: string
  questionType: string
  difficulty: string
  examType: string
  questionText: string
  passageText: string
  /** Option texts in label order. Empty entries are dropped during validation. */
  options: string[]
  correctAnswer: string
  workedSolution: string
  shortExplanation: string
  status: string
  tags: string
  yearLevel: string
}

export interface ImportRowIssue {
  field: string
  message: string
}

/** A fully resolved, insert-ready question (ids resolved, values normalised). */
export interface ResolvedImportQuestion {
  subjectId: string
  topicId: string
  questionTypeId: string | null
  examType: ExamType
  difficulty: number
  yearLevel: number | null
  questionText: string
  passageText: string | null
  /** Option texts in label order (A, B, C, ...). */
  options: string[]
  correctOptionLabel: QuestionOptionLabel
  workedSolution: string
  shortExplanation: string | null
  tags: string[]
  status: QuestionStatus
}

export interface ValidatedImportRow {
  rowNumber: number
  questionPreview: string
  subjectLabel: string
  topicLabel: string
  questionTypeLabel: string
  statusLabel: string
  optionsCount: number
  correctAnswerLabel: string
  errors: ImportRowIssue[]
  warnings: ImportRowIssue[]
  isDuplicate: boolean
  isImportable: boolean
  resolved: ResolvedImportQuestion | null
}

export interface ImportValidationResult {
  format: ImportFormat
  totalRows: number
  readyCount: number
  warningCount: number
  errorCount: number
  duplicateCount: number
  rows: ValidatedImportRow[]
  parseError?: string
}

export interface ImportSummary {
  importedCount: number
  skippedDuplicateCount: number
  failedCount: number
}

export interface ImportReference {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
}
