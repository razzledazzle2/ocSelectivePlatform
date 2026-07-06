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

/**
 * Admin-controlled import behaviour. Defaults are forgiving: import as draft,
 * auto-create missing taxonomy, allow missing short explanations, warn (not
 * block) on duplicates.
 */
export interface ImportSettings {
  importStatus: Extract<QuestionStatus, 'draft' | 'published'>
  createMissingTopics: boolean
  createMissingQuestionTypes: boolean
  requireShortExplanation: boolean
  blockDuplicates: boolean
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  importStatus: 'draft',
  createMissingTopics: true,
  createMissingQuestionTypes: true,
  requireShortExplanation: false,
  blockDuplicates: false,
}

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

/** Whether a validated row can import cleanly, imports with warnings, or is blocked. */
export type ImportRowStatus = 'ready' | 'warning' | 'error'

/**
 * A fully resolved, insert-ready question. Taxonomy may still be pending
 * creation: a null topicId/questionTypeId together with a non-empty name means
 * "create this under the subject at import time" (auto-create was enabled).
 */
export interface ResolvedImportQuestion {
  subjectId: string
  topicId: string | null
  topicName: string
  questionTypeId: string | null
  questionTypeName: string | null
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
  rowStatus: ImportRowStatus
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
  /** Rows that will import (no blocking errors) — includes rows with warnings. */
  importableCount: number
  /** Importable rows with zero warnings. */
  readyCount: number
  /** Rows carrying at least one warning. */
  warningCount: number
  /** Rows blocked by a structural error. */
  errorCount: number
  duplicateCount: number
  rows: ValidatedImportRow[]
  parseError?: string
}

export interface ImportSummary {
  importedCount: number
  skippedDuplicateCount: number
  createdTopicCount: number
  createdQuestionTypeCount: number
  failedCount: number
}

export interface ImportReference {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  existingTags: string[]
}
