import type { AnswerFormat } from '@/lib/types'
import type { MockTestSectionKey } from '@/lib/mock-tests/types'
import type { MockCsvRow } from '@/lib/mock-import/types'

/**
 * The dedicated Mock CSV schema — deliberately separate from the question-bank
 * import schema. Each row is one question in one mock. A row either provides
 * full question content OR references an existing bank question via
 * `existing_question_external_id` (never a partial mix — see validation).
 */

type MockColumnKey = Exclude<keyof MockCsvRow, 'rowNumber'>

/** Canonical header + accepted aliases for every column, and whether it is required. */
interface MockColumnSpec {
  key: MockColumnKey
  /** Canonical header emitted by the template/export. */
  header: string
  /** Extra accepted header spellings on import (case/space/underscore-insensitive). */
  aliases: string[]
  required: boolean
}

export const MOCK_CSV_COLUMNS: MockColumnSpec[] = [
  { key: 'mockExternalId', header: 'mock_external_id', aliases: ['mock_id', 'mock_ref'], required: true },
  { key: 'mockName', header: 'mock_name', aliases: ['mock_title'], required: true },
  { key: 'subject', header: 'subject', aliases: ['subject_slug', 'subject_name'], required: true },
  { key: 'domain', header: 'domain', aliases: ['domain_code'], required: true },
  { key: 'subtopic', header: 'subtopic', aliases: ['subtopic_code'], required: true },
  { key: 'skill', header: 'skill', aliases: ['skill_code'], required: false },
  { key: 'difficulty', header: 'difficulty', aliases: [], required: true },
  { key: 'questionFamily', header: 'question_family', aliases: ['family'], required: true },
  { key: 'stimulusType', header: 'stimulus_type', aliases: ['stimulus_format'], required: true },
  { key: 'stimulusGenre', header: 'stimulus_genre', aliases: [], required: true },
  { key: 'responseFormat', header: 'response_format', aliases: ['answer_format'], required: true },
  { key: 'patternKey', header: 'pattern_key', aliases: [], required: true },
  { key: 'questionText', header: 'question_text', aliases: ['question'], required: true },
  { key: 'optionA', header: 'option_a', aliases: [], required: false },
  { key: 'optionB', header: 'option_b', aliases: [], required: false },
  { key: 'optionC', header: 'option_c', aliases: [], required: false },
  { key: 'optionD', header: 'option_d', aliases: [], required: false },
  { key: 'optionE', header: 'option_e', aliases: [], required: false },
  { key: 'correctAnswer', header: 'correct_answer', aliases: ['correct_option_label', 'answer'], required: true },
  { key: 'workedSolution', header: 'worked_solution', aliases: ['solution'], required: true },
  { key: 'shortExplanation', header: 'short_explanation', aliases: ['explanation'], required: false },
  { key: 'marks', header: 'marks', aliases: [], required: true },
  { key: 'orderIndex', header: 'order_index', aliases: ['order', 'sort_order'], required: true },
  // Optional
  { key: 'tags', header: 'tags', aliases: [], required: false },
  { key: 'sectionKey', header: 'section_key', aliases: ['section'], required: false },
  { key: 'questionExternalId', header: 'question_external_id', aliases: ['external_id', 'question_id'], required: false },
  {
    key: 'existingQuestionExternalId',
    header: 'existing_question_external_id',
    aliases: ['existing_external_id', 'bank_external_id'],
    required: false,
  },
  { key: 'assetFilename', header: 'asset_filename', aliases: ['asset_file', 'asset_ref'], required: false },
  { key: 'assetType', header: 'asset_type', aliases: [], required: false },
  { key: 'assetRenderMethod', header: 'asset_render_method', aliases: [], required: false },
  { key: 'assetAltText', header: 'asset_alt_text', aliases: ['alt_text'], required: false },
  { key: 'assetRequired', header: 'asset_required', aliases: [], required: false },
]

/** Ordered canonical headers, used for the downloadable template and every export. */
export const MOCK_CSV_TEMPLATE_HEADERS: string[] = MOCK_CSV_COLUMNS.map((column) => column.header)

export const MOCK_CSV_TEMPLATE_FILENAME = 'mock-import-template.csv'

/** Normalise a header cell to a comparison key (lowercase, alphanumerics only). */
export function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Build header-key → column-key lookup, covering canonical headers and aliases. */
export function buildHeaderIndex(): Map<string, MockColumnKey> {
  const index = new Map<string, MockColumnKey>()
  for (const column of MOCK_CSV_COLUMNS) {
    index.set(normalizeHeaderKey(column.header), column.key)
    for (const alias of column.aliases) {
      index.set(normalizeHeaderKey(alias), column.key)
    }
  }
  return index
}

/** Columns that must be present (by canonical header) for the file to be parseable at all. */
export const MOCK_CSV_REQUIRED_HEADERS: string[] = MOCK_CSV_COLUMNS.filter((column) => column.required).map(
  (column) => column.header
)

/**
 * Response-format vocabulary the CSV accepts, each mapped to a stored answer_format.
 * Deterministic and case-insensitive; anything else is a row error.
 */
const RESPONSE_FORMAT_MAP: Record<string, AnswerFormat> = {
  multiple_choice: 'single_choice',
  multiplechoice: 'single_choice',
  single_choice: 'single_choice',
  singlechoice: 'single_choice',
  mcq: 'single_choice',
  written: 'extended_response',
  written_response: 'extended_response',
  extended_response: 'extended_response',
  extendedresponse: 'extended_response',
  free_response: 'extended_response',
}

export const MOCK_RESPONSE_FORMAT_LABELS = 'multiple_choice or written_response'

/** Resolve a CSV response_format cell to a stored answer_format, or null if unknown. */
export function normalizeResponseFormat(raw: string): AnswerFormat | null {
  const key = raw.trim().toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '')
  return RESPONSE_FORMAT_MAP[key] ?? null
}

/**
 * Map a canonical subject code to the mock section it belongs in. Anything
 * outside the four standard sections falls back to 'custom'.
 */
export function sectionKeyForSubjectCode(subjectCode: string | null): MockTestSectionKey {
  switch (subjectCode) {
    case 'reading':
      return 'reading'
    case 'mathematical_reasoning':
      return 'mathematical_reasoning'
    case 'thinking_skills':
      return 'thinking_skills'
    case 'writing':
      return 'writing'
    default:
      return 'custom'
  }
}

const SECTION_KEYS: MockTestSectionKey[] = [
  'reading',
  'mathematical_reasoning',
  'thinking_skills',
  'writing',
  'custom',
]

/** Validate an explicit section_key cell; returns null when the cell is blank. */
export function normalizeSectionKey(raw: string): MockTestSectionKey | null | undefined {
  const trimmed = raw.trim().toLowerCase().replace(/[^a-z]+/g, '_')
  if (!trimmed) return null
  return SECTION_KEYS.includes(trimmed as MockTestSectionKey) ? (trimmed as MockTestSectionKey) : undefined
}

/** Canonical subject code → subjects.slug (codes use '_', slugs use '-'). */
export function subjectSlugForCode(subjectCode: string): string {
  return subjectCode.replace(/_/g, '-')
}

/** Export modes for a mock CSV (client-safe so the UI can list them). */
export const MOCK_EXPORT_MODES = ['full', 'reference', 'mixed'] as const
export type MockExportMode = (typeof MOCK_EXPORT_MODES)[number]

export const MOCK_EXPORT_MODE_LABELS: Record<MockExportMode, string> = {
  full: 'Full content',
  reference: 'Reference only',
  mixed: 'Mixed (reference bank, full for new)',
}

/** Escape a single CSV cell (quote when it contains a comma, quote or newline). */
export function escapeMockCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Downloadable template: header row + one worked example row. Client-safe (no DB). */
export function buildMockTemplateCsv(): string {
  const example: Partial<Record<keyof MockCsvRow, string>> = {
    mockExternalId: 'mr-selective-01',
    mockName: 'Mathematical Reasoning Practice 1',
    subject: 'mathematical-reasoning',
    domain: 'number_algebra',
    subtopic: 'fractions',
    difficulty: '3',
    questionFamily: 'standard_multiple_choice',
    stimulusType: 'none',
    stimulusGenre: 'none',
    responseFormat: 'multiple_choice',
    patternKey: 'fraction_of_quantity',
    questionText: 'What is 3/4 of 20?',
    optionA: '12',
    optionB: '15',
    optionC: '16',
    optionD: '18',
    correctAnswer: 'B',
    workedSolution: '3/4 × 20 = 15.',
    marks: '1',
    orderIndex: '1',
  }
  const row = MOCK_CSV_COLUMNS.map((column) =>
    escapeMockCsvCell((example as Record<string, string | undefined>)[column.key] ?? '')
  )
  return `${MOCK_CSV_TEMPLATE_HEADERS.join(',')}\n${row.join(',')}\n`
}
