import type { ExistingQuestionSnapshot } from '@/lib/questions/queries'
import type {
  AnswerFormat,
  AssetStatus,
  AssetType,
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
 * create            — insert rows whose external_id does not already exist; matching ids are
 *                      flagged as duplicates and skipped (never updated).
 * update            — update rows whose external_id already exists; ids with no existing match
 *                      are rejected (never created).
 * create_and_update — insert new external_ids, update matching ones. Never deletes/touches
 *                      records that are simply absent from the file.
 */
export type ImportMode = 'create' | 'update' | 'create_and_update'

/** How a blank incoming cell is treated on an update: preserve, or wipe, the existing value. */
export type BlankCellBehavior = 'keep' | 'clear'

/**
 * Admin-controlled import behaviour. Defaults are forgiving: import as draft,
 * auto-create missing taxonomy, allow missing short explanations, create-only
 * (never silently overwrite existing questions), keep existing values on blank cells.
 */
export interface ImportSettings {
  importStatus: Extract<QuestionStatus, 'draft' | 'published'>
  mode: ImportMode
  blankCellBehavior: BlankCellBehavior
  createMissingTopics: boolean
  createMissingQuestionTypes: boolean
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  importStatus: 'draft',
  mode: 'create',
  blankCellBehavior: 'keep',
  createMissingTopics: true,
  createMissingQuestionTypes: true,
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
  /** Raw JSON string for the structured asset spec (coordinate_grid, bar_chart, …). */
  assetSpecJson: string
  /** Explicit asset lifecycle state (pending/generated/approved/…). */
  assetStatus: string
  /** Explicit asset type override (image/svg/diagram/…); inferred from extension when blank. */
  assetType: string
  /** "true"/"false" — whether the row's asset refs must be ready before publish. Defaults true. */
  assetRequired: string
  // -- Canonical taxonomy v1 (raw codes; src/lib/taxonomy) --------------------
  domainCode: string
  subtopicCode: string
  skillCode: string
  patternKey: string
  questionFamily: string
  stimulusFormat: string
  stimulusGenre: string
  assetRenderMethod: string
  writingForm: string
  writingPurpose: string
  writingPromptStimulus: string
}

export interface ImportRowIssue {
  field: string
  message: string
}

/** Whether a validated row can import cleanly, imports with warnings, or is blocked. */
export type ImportRowStatus = 'ready' | 'warning' | 'error'

/** What will actually happen to a row when the import runs. */
export type ImportRowAction = 'create' | 'update' | 'unchanged' | 'skip_duplicate'

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

/** One field's before/after/final value for an update row's preview diff. */
export interface FieldDiff {
  field: string
  label: string
  existing: string
  incoming: string
  final: string
  changed: boolean
}

/** How one asset reference on a row resolves in the import preview. */
export type AssetPreviewState = 'not_required' | 'ready' | 'pending' | 'missing' | 'invalid' | 'rejected'

export interface AssetRefPreview {
  ref: string
  /** Which column/role the ref came from, e.g. "question_asset_refs", "option_asset_refs_json.A". */
  field: string
  state: AssetPreviewState
  message?: string
  /** File size in bytes (only for a file resolved from an uploaded package). */
  sizeBytes?: number
  /** Pixel dimensions, when the uploaded file is a readable raster. */
  width?: number
  height?: number
  mimeType?: string
  /** base64 data URI of the uploaded file, for the review-screen thumbnail (small files only). */
  previewDataUri?: string
}

/** A file extracted from an uploaded assets ZIP (or the standalone assets ZIP). */
export interface UploadedAssetFile {
  /** Normalised, traversal-safe relative path, e.g. "mr-area-001.svg". */
  relativePath: string
  filename: string
  size: number
  buffer: Buffer
}

/**
 * A fully resolved, insert-ready question. Taxonomy may still be pending
 * creation: a null topicId/questionTypeId together with a non-empty name means
 * "create this under the subject at import time" (auto-create was enabled).
 */
export interface ResolvedImportQuestion {
  /** What the import step should do with this row. */
  action: 'create' | 'update'
  /** Set when action === 'update'. */
  existingQuestionId: string | null
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
  /** Kept so an update with a blank stimulus_id cell doesn't unlink an existing stimulus. */
  existingStimulusId: string | null
  questionAssetRefs: string[]
  solutionAssetRefs: string[]
  rubric: WritingRubric | null
  presentation: QuestionPresentation
  sourceInfo: QuestionSourceInfo
  assetGenerationPrompt: string | null
  assetAltText: string | null
  /** Parsed structured asset spec (from asset_spec_json), or null when absent/invalid. */
  assetSpec: Record<string, unknown> | null
  /** Explicit asset status (from asset_status), or null to let the ref scheme decide. */
  assetStatus: AssetStatus | null
  assetType: AssetType | null
  /** Whether this row's asset refs must be ready before the question can publish. */
  assetRequired: boolean
  tags: string[]
  skillTags: string[]
  conceptTags: string[]
  status: QuestionStatus
  // -- Canonical taxonomy v1 (resolved codes; null when unset) ----------------
  domainCode: string | null
  subtopicCode: string | null
  skillCode: string | null
  patternKey: string | null
  questionFamily: string | null
  stimulusFormat: string | null
  stimulusGenre: string | null
  assetRenderMethod: string | null
  writingForm: string | null
  writingPurpose: string | null
  writingPromptStimulus: string | null
}

export interface ValidatedImportRow {
  rowNumber: number
  rowStatus: ImportRowStatus
  action: ImportRowAction
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
  /** Only populated when action === 'update'; changed fields only need to be rendered by the UI. */
  diffs: FieldDiff[]
  assetPreviews: AssetRefPreview[]
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
  createCount: number
  updateCount: number
  unchangedCount: number
  missingAssetCount: number
  /** Referenced files that failed validation (bad MIME/oversize/etc.). */
  invalidAssetCount: number
  /** Asset references successfully resolved to a valid uploaded/generated/external file. */
  resolvedAssetCount: number
  /** Total files extracted from the uploaded package (0 for a plain CSV/paste import). */
  uploadedFileCount: number
  /** Uploaded asset files never referenced by any row. */
  unusedAssetFiles: string[]
  rows: ValidatedImportRow[]
  parseError?: string
}

export interface ImportSummary {
  importedCount: number
  updatedCount: number
  unchangedCount: number
  skippedDuplicateCount: number
  createdTopicCount: number
  createdQuestionTypeCount: number
  createdVariantCount: number
  createdStimulusCount: number
  createdAssetCount: number
  /** New assets whose deterministic SVG was generated during import. */
  generatedAssetCount: number
  /** Assets uploaded from a provided ZIP package. */
  uploadedAssetCount: number
  /** Uploaded files that failed validation/sanitisation and were rejected. */
  rejectedAssetCount: number
  /** Uploaded files whose bytes were identical to another asset and were reused (deduped). */
  duplicateChecksumCount: number
  /** Asset rows already present in the DB (matched on external_ref) that were reused, not re-created. */
  reusedExistingAssetCount: number
  /** Role-specific asset relationships written this run (question/solution/option/stimulus links). */
  assetLinksCreated: number
  failedCount: number
  /** Notices about staged assets that could not be fully cleaned up after a failed import. */
  cleanupWarnings: string[]
  /** Non-blocking notices for assets that stayed pending (unsupported/no spec). */
  assetWarnings: string[]
  unusedAssetFiles: string[]
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
  /** Full snapshots of existing questions referenced by this file's external_ids, for diffing. */
  existingByExternalId: Map<string, ExistingQuestionSnapshot>
}
