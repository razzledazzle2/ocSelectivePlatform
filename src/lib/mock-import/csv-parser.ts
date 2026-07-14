import { parseCsvText } from '@/lib/csv/parse'
import { buildHeaderIndex, MOCK_CSV_COLUMNS, normalizeHeaderKey } from '@/lib/mock-import/schema'
import type { MockCsvParseResult, MockCsvRow } from '@/lib/mock-import/types'

const EMPTY_ROW: Omit<MockCsvRow, 'rowNumber'> = {
  mockExternalId: '',
  mockName: '',
  questionExternalId: '',
  existingQuestionExternalId: '',
  subject: '',
  domain: '',
  subtopic: '',
  skill: '',
  difficulty: '',
  questionFamily: '',
  stimulusType: '',
  stimulusGenre: '',
  responseFormat: '',
  patternKey: '',
  questionText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  optionE: '',
  correctAnswer: '',
  workedSolution: '',
  shortExplanation: '',
  marks: '',
  orderIndex: '',
  tags: '',
  sectionKey: '',
  assetFilename: '',
  assetType: '',
  assetRenderMethod: '',
  assetAltText: '',
  assetRequired: '',
}

/**
 * Parse mock CSV text into typed rows. Header matching is alias-aware and
 * case/space/underscore-insensitive. Fails fast with a clear message when the
 * header line is missing required columns — never silently drops columns.
 */
export function parseMockCsv(text: string): MockCsvParseResult {
  const table = parseCsvText(text)
  if (table.length === 0) {
    return { rows: [], error: 'The mock CSV is empty.' }
  }

  const headerRow = table[0]
  const headerIndex = buildHeaderIndex()
  // column key → source column position
  const positionByKey = new Map<string, number>()
  headerRow.forEach((rawHeader, position) => {
    const key = headerIndex.get(normalizeHeaderKey(rawHeader))
    if (key && !positionByKey.has(key)) {
      positionByKey.set(key, position)
    }
  })

  const missingRequired = MOCK_CSV_COLUMNS.filter(
    (column) => column.required && !positionByKey.has(column.key)
  ).map((column) => column.header)

  if (missingRequired.length > 0) {
    return {
      rows: [],
      error: `The mock CSV is missing required column${
        missingRequired.length === 1 ? '' : 's'
      }: ${missingRequired.join(', ')}.`,
    }
  }

  const rows: MockCsvRow[] = []
  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index]
    const row: MockCsvRow = { ...EMPTY_ROW, rowNumber: index + 1 }
    for (const column of MOCK_CSV_COLUMNS) {
      const position = positionByKey.get(column.key)
      if (position === undefined) continue
      const value = cells[position]
      if (value !== undefined) {
        row[column.key] = value.trim()
      }
    }
    rows.push(row)
  }

  return { rows }
}
