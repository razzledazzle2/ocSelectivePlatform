import type {
  AnswerFormat,
  ExamType,
  QuestionOptionLabel,
  QuestionPresentation,
  QuestionSource,
  QuestionSourceInfo,
  QuestionStatus,
  QuestionTypeRecord,
  QuestionVariantRecord,
  StimulusType,
  SubjectRecord,
  TopicRecord,
  WritingRubric,
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
  externalId: string
  subject: string
  strand: string
  topic: string
  questionType: string
  variantType: string
  difficulty: string
  examType: string
  marks: string
  timeLimitSeconds: string
  answerFormat: string
  questionText: string
  passageText: string
  /** Option texts in label order. Empty entries are dropped during validation. */
  options: string[]
  /** JSON object keyed by option label ("A"–"E") → asset ref. */
  optionAssetRefsJson: string
  /** JSON object keyed by option label ("A"–"E") → per-option explanation. */
  optionExplanationsJson: string
  correctAnswer: string
  workedSolution: string
  shortExplanation: string
  /** External stimulus ref (e.g. stim-read-01) grouping rows onto one stimulus. */
  stimulusId: string
  stimulusTitle: string
  stimulusType: string
  stimulusText: string
  stimulusAssetRefs: string[]
  questionAssetRefs: string[]
  solutionAssetRefs: string[]
  inputMethod: string
  displayMode: string
  answerValidationJson: string
  rubricJson: string
  skillTags: string
  conceptTags: string
  status: string
  tags: string
  yearLevel: string
  sourceName: string
  sourcePaper: string
  sourceSection: string
  sourceQuestionNumber: string
  licenseNotes: string
  assetGenerationPrompt: string
  assetAltText: string
}

export interface ImportRowIssue {
  field: string
  message: string
}

/** Whether a validated row can import cleanly, imports with warnings, or is blocked. */
export type ImportRowStatus = 'ready' | 'warning' | 'error'

/**
 * A stimulus definition resolved from the import file (merged across the rows
 * sharing one stimulus ref). Null bodyMarkdown means the definition only named
 * the stimulus. When the ref already exists in the DB the definition is
 * ignored and the existing stimulus is linked instead.
 */
export interface ResolvedImportStimulus {
  externalRef: string
  title: string
  stimulusType: StimulusType
  bodyMarkdown: string | null
  assetRefs: string[]
}

/**
 * A fully resolved, insert-ready question. Taxonomy may still be pending
 * creation: a null topicId/questionTypeId together with a non-empty name means
 * "create this under the subject at import time" (auto-create was enabled).
 */
export interface ResolvedImportQuestion {
  externalId: string | null
  subjectId: string
  topicId: string | null
  topicName: string
  /** Stored on the topic when it is auto-created (existing topics are untouched). */
  strand: string | null
  questionTypeId: string | null
  questionTypeName: string | null
  /** Existing variant id, or (when null with a name) a variant to auto-create under the question type. */
  variantId: string | null
  variantName: string | null
  examType: ExamType
  difficulty: number
  yearLevel: number | null
  marks: number
  timeLimitSeconds: number | null
  answerFormat: AnswerFormat
  questionText: string
  passageText: string | null
  /** Option texts in label order (A, B, C, ...). Blank text is allowed for visual options. */
  options: string[]
  /** Positional asset refs / explanations aligned with options (null = none). */
  optionAssetRefs: Array<string | null>
  optionExplanations: Array<string | null>
  correctOptionLabel: QuestionOptionLabel | null
  workedSolution: string
  shortExplanation: string | null
  /** External stimulus ref this question links to (definition may be in-file or in-DB). */
  stimulusExternalRef: string | null
  /** In-file stimulus definition; null when the ref resolves to an existing DB stimulus. */
  stimulusDefinition: ResolvedImportStimulus | null
  questionAssetRefs: string[]
  solutionAssetRefs: string[]
  rubric: WritingRubric | null
  presentation: QuestionPresentation
  sourceInfo: QuestionSourceInfo
  assetGenerationPrompt: string | null
  assetAltText: string | null
  tags: string[]
  skillTags: string[]
  conceptTags: string[]
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
  createdVariantCount: number
  createdStimulusCount: number
  createdAssetCount: number
  failedCount: number
}

export interface ImportReference {
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  questionVariants: QuestionVariantRecord[]
  existingTags: string[]
  /** stimuli.external_ref values already in the DB. */
  existingStimulusRefs: string[]
  /** questions.external_id values already in the DB. */
  existingExternalIds: string[]
}
