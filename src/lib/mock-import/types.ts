import type { AnswerFormat, ExamType, QuestionOptionLabel, QuestionStatus } from '@/lib/types'
import type { MockTestSectionKey, MockType } from '@/lib/mock-tests/types'
import type { UploadedAssetFile } from '@/lib/import/types'
import type { BlueprintEvaluation } from '@/lib/mock-blueprints/types'

export type { UploadedAssetFile }

/** How a mock CSV upload is applied. */
export const MOCK_IMPORT_MODES = ['create', 'update'] as const
export type MockImportMode = (typeof MOCK_IMPORT_MODES)[number]

/**
 * Admin-controlled behaviour for a mock CSV import.
 * `alsoAddToBank` promotes newly created questions into the browsable bank
 * (origin = 'bank'); off keeps them mock-only (origin = 'mock_import').
 * `status` is the status new questions are created with (drafts by default so
 * they get reviewed before students can see them via any other surface).
 */
export interface MockImportSettings {
  mode: MockImportMode
  alsoAddToBank: boolean
  /** Status for the mock itself; always 'draft' on import — publish is a separate, gated step. */
  questionStatus: Extract<QuestionStatus, 'draft' | 'published'>
  /** Enforce the linked blueprint's hard rules as blocking errors. */
  enforceBlueprint: boolean
}

/** One raw CSV row (strings straight from the file, before validation). */
export interface MockCsvRow {
  rowNumber: number
  mockExternalId: string
  mockName: string
  /** This question's own stable external id (optional; generated if blank). */
  questionExternalId: string
  /** Link to an existing bank question by external id instead of defining content. */
  existingQuestionExternalId: string
  subject: string
  domain: string
  subtopic: string
  skill: string
  difficulty: string
  questionFamily: string
  stimulusType: string
  stimulusGenre: string
  responseFormat: string
  patternKey: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  optionE: string
  correctAnswer: string
  workedSolution: string
  shortExplanation: string
  marks: string
  orderIndex: string
  tags: string
  /** Optional explicit section key; otherwise derived from subject. */
  sectionKey: string
  assetFilename: string
  assetType: string
  assetRenderMethod: string
  assetAltText: string
  assetRequired: string
}

export interface MockCsvParseResult {
  rows: MockCsvRow[]
  error?: string
}

export type MockRowStatus = 'ready' | 'warning' | 'error'

/** Whether a validated row defines a new question or references an existing one. */
export type MockRowKind = 'new_question' | 'existing_reference'

export interface MockRowIssue {
  field: string
  /** The offending value, when there is one. */
  value?: string
  message: string
  /** What a correct value looks like — surfaced verbatim in the preview. */
  expected?: string
}

/** A fully-resolved question ready to be created or linked into a mock. */
export interface ResolvedMockQuestion {
  kind: MockRowKind
  /** Stable external id used to create/find the underlying question row. */
  externalId: string
  /** Set only for existing_reference rows once resolved against the bank. */
  existingQuestionId: string | null
  subjectCode: string | null
  subjectSlug: string | null
  domainCode: string | null
  subtopicCode: string | null
  skillCode: string | null
  examType: ExamType
  difficulty: number
  marks: number
  questionFamily: string | null
  stimulusFormat: string | null
  stimulusGenre: string | null
  answerFormat: AnswerFormat
  patternKey: string | null
  questionText: string
  options: string[]
  correctOptionLabel: QuestionOptionLabel | null
  workedSolution: string | null
  shortExplanation: string | null
  tags: string[]
  sectionKey: MockTestSectionKey
  orderIndex: number
  /** Single primary asset for the question stem, if any. */
  assetRef: string | null
  assetType: string | null
  assetRenderMethod: string | null
  assetAltText: string | null
  assetRequired: boolean
}

export type MockAssetState = 'not_required' | 'ready' | 'pending' | 'missing' | 'invalid'

export interface MockAssetPreview {
  ref: string
  state: MockAssetState
  message?: string
}

export interface ValidatedMockRow {
  rowNumber: number
  rowStatus: MockRowStatus
  kind: MockRowKind
  errors: MockRowIssue[]
  warnings: MockRowIssue[]
  /** True when the row is safe to import (no errors). */
  isImportable: boolean
  resolved: ResolvedMockQuestion | null
  assetPreview: MockAssetPreview | null
  /** Short human summary of the question for the preview table. */
  summary: string
}

/** Result of validating a whole mock CSV (one mock per file). */
export interface MockImportValidationResult {
  mockExternalId: string | null
  mockName: string | null
  totalRows: number
  importableCount: number
  readyCount: number
  warningCount: number
  errorCount: number
  newQuestionCount: number
  referencedQuestionCount: number
  missingAssetCount: number
  duplicateOrderIndexes: number[]
  /** True when a mock with this mock_external_id already exists (→ update). */
  matchesExistingMock: boolean
  existingMockId: string | null
  rows: ValidatedMockRow[]
  /** Files present in the ZIP that no row referenced. */
  unusedAssetFiles: string[]
  /** Blueprint check outcome when a blueprint was supplied. */
  blueprint: BlueprintEvaluation | null
  /** File-level parse/shape error that stopped validation entirely. */
  parseError?: string
}

/** Section-level diff line shown before applying an update. */
export interface MockDiffLine {
  kind: 'question_added' | 'question_removed' | 'question_updated' | 'meta_changed'
  label: string
  before?: string
  after?: string
}

export interface MockImportSummary {
  mockTestId: string
  mockName: string
  created: boolean
  updated: boolean
  questionsCreated: number
  questionsUpdated: number
  questionsReferenced: number
  questionsRemoved: number
  assetsUploaded: number
  assetsPending: number
  assetsRejected: number
  addedToBank: number
  warnings: string[]
}
