import { parseCsvText } from '@/lib/csv/parse'
import { QUESTION_OPTION_LABELS } from '@/lib/types'
import type { QuestionImportRow } from '@/lib/import/types'

type ScalarColumnKey = keyof Omit<
  QuestionImportRow,
  'rowNumber' | 'options' | 'stimulusAssetRefs' | 'questionAssetRefs' | 'solutionAssetRefs'
>

type MultiRefColumnKey = Extract<
  keyof QuestionImportRow,
  'stimulusAssetRefs' | 'questionAssetRefs' | 'solutionAssetRefs'
>

// Accept both the user-friendly headers and the slug-based headers. Old v1
// headers (question_type, passage_text, ...) keep working alongside the v2 set.
const HEADER_ALIASES: Record<ScalarColumnKey, string[]> = {
  externalId: ['external_id', 'external_ref', 'question_id'],
  subject: ['subject', 'subject_slug', 'subject_name'],
  strand: ['strand'],
  topic: ['topic', 'topic_slug', 'topic_name'],
  questionType: [
    'essential_question_type',
    'question_type',
    'question_type_slug',
    'question_type_name',
    'type',
  ],
  variantType: ['variant_type', 'variant'],
  difficulty: ['difficulty'],
  examType: ['exam_type', 'exam'],
  marks: ['marks'],
  timeLimitSeconds: ['time_limit_seconds', 'time_limit'],
  answerFormat: ['answer_format', 'format'],
  questionText: ['question_text', 'question'],
  passageText: ['passage_text', 'passage'],
  optionAssetRefsJson: ['option_asset_refs_json', 'option_asset_refs'],
  optionExplanationsJson: ['option_explanations_json', 'option_explanations'],
  correctAnswer: ['correct_answer', 'correct_option_label', 'answer', 'correct'],
  workedSolution: ['solution', 'worked_solution'],
  shortExplanation: ['short_explanation', 'explanation'],
  stimulusId: ['stimulus_id', 'stimulus_ref'],
  stimulusTitle: ['stimulus_title'],
  stimulusType: ['stimulus_type'],
  stimulusText: ['stimulus_text', 'stimulus_body'],
  inputMethod: ['input_method'],
  displayMode: ['display_mode'],
  answerValidationJson: ['answer_validation_json', 'answer_validation'],
  rubricJson: ['rubric_json', 'rubric'],
  skillTags: ['skill_tags'],
  conceptTags: ['concept_tags'],
  status: ['status'],
  tags: ['tags'],
  yearLevel: ['year_level', 'year'],
  sourceName: ['source_name'],
  sourcePaper: ['source_paper'],
  sourceSection: ['source_section'],
  sourceQuestionNumber: ['source_question_number'],
  licenseNotes: ['license_notes'],
  assetGenerationPrompt: ['asset_generation_prompt'],
  assetAltText: ['asset_alt_text'],
  assetSpecJson: ['asset_spec_json', 'asset_spec'],
  assetStatus: ['asset_status'],
  assetType: ['asset_type'],
  assetRequired: ['asset_required'],
  // Canonical taxonomy v1 (codes, not labels). Optional in every CSV.
  domainCode: ['domain_code', 'domain'],
  subtopicCode: ['subtopic_code', 'subtopic'],
  skillCode: ['skill_code', 'skill'],
  patternKey: ['pattern_key'],
  questionFamily: ['question_family'],
  stimulusFormat: ['stimulus_format'],
  stimulusGenre: ['stimulus_genre'],
  assetRenderMethod: ['asset_render_method'],
  writingForm: ['writing_form'],
  writingPurpose: ['writing_purpose'],
  writingPromptStimulus: ['writing_prompt_stimulus'],
}

const MULTI_REF_ALIASES: Record<MultiRefColumnKey, string[]> = {
  stimulusAssetRefs: ['stimulus_asset_refs'],
  questionAssetRefs: ['question_asset_refs'],
  solutionAssetRefs: ['solution_asset_refs'],
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

/** Splits a multi-ref cell ("a.svg; b.svg" or comma-separated) into clean refs. */
export function splitAssetRefs(cell: string): string[] {
  return cell
    .split(/[;,]/)
    .map((ref) => ref.trim())
    .filter(Boolean)
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
  const findColumn = (aliases: string[]): number =>
    aliases.reduce((found, alias) => (found !== -1 ? found : headers.indexOf(alias)), -1)

  const columnIndex = {} as Record<ScalarColumnKey, number>
  for (const key of Object.keys(HEADER_ALIASES) as ScalarColumnKey[]) {
    columnIndex[key] = findColumn(HEADER_ALIASES[key])
  }

  const multiRefIndex = {} as Record<MultiRefColumnKey, number>
  for (const key of Object.keys(MULTI_REF_ALIASES) as MultiRefColumnKey[]) {
    multiRefIndex[key] = findColumn(MULTI_REF_ALIASES[key])
  }

  const optionIndexes = OPTION_HEADER_ALIASES.map(findColumn)
  const optionsJsonIndex = findColumn(OPTIONS_JSON_ALIASES)

  if (columnIndex.questionText === -1) {
    return { rows: [], error: 'The CSV must include a "question_text" (or "question") column.' }
  }

  if (
    optionsJsonIndex === -1 &&
    optionIndexes.every((index) => index === -1) &&
    columnIndex.answerFormat === -1
  ) {
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
    const getRefs = (key: MultiRefColumnKey): string[] => {
      const at = multiRefIndex[key]
      return at === -1 ? [] : splitAssetRefs(cells[at] ?? '')
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
      externalId: get('externalId'),
      subject: get('subject'),
      strand: get('strand'),
      topic: get('topic'),
      questionType: get('questionType'),
      variantType: get('variantType'),
      difficulty: get('difficulty'),
      examType: get('examType'),
      marks: get('marks'),
      timeLimitSeconds: get('timeLimitSeconds'),
      answerFormat: get('answerFormat'),
      questionText: get('questionText'),
      passageText: get('passageText'),
      options: trimTrailingEmpty(options),
      optionAssetRefsJson: get('optionAssetRefsJson'),
      optionExplanationsJson: get('optionExplanationsJson'),
      correctAnswer: get('correctAnswer'),
      workedSolution: get('workedSolution'),
      shortExplanation: get('shortExplanation'),
      stimulusId: get('stimulusId'),
      stimulusTitle: get('stimulusTitle'),
      stimulusType: get('stimulusType'),
      stimulusText: get('stimulusText'),
      stimulusAssetRefs: getRefs('stimulusAssetRefs'),
      questionAssetRefs: getRefs('questionAssetRefs'),
      solutionAssetRefs: getRefs('solutionAssetRefs'),
      inputMethod: get('inputMethod'),
      displayMode: get('displayMode'),
      answerValidationJson: get('answerValidationJson'),
      rubricJson: get('rubricJson'),
      skillTags: get('skillTags'),
      conceptTags: get('conceptTags'),
      status: get('status'),
      tags: get('tags'),
      yearLevel: get('yearLevel'),
      sourceName: get('sourceName'),
      sourcePaper: get('sourcePaper'),
      sourceSection: get('sourceSection'),
      sourceQuestionNumber: get('sourceQuestionNumber'),
      licenseNotes: get('licenseNotes'),
      assetGenerationPrompt: get('assetGenerationPrompt'),
      assetAltText: get('assetAltText'),
      assetSpecJson: get('assetSpecJson'),
      assetStatus: get('assetStatus'),
      assetType: get('assetType'),
      assetRequired: get('assetRequired'),
      domainCode: get('domainCode'),
      subtopicCode: get('subtopicCode'),
      skillCode: get('skillCode'),
      patternKey: get('patternKey'),
      questionFamily: get('questionFamily'),
      stimulusFormat: get('stimulusFormat'),
      stimulusGenre: get('stimulusGenre'),
      assetRenderMethod: get('assetRenderMethod'),
      writingForm: get('writingForm'),
      writingPurpose: get('writingPurpose'),
      writingPromptStimulus: get('writingPromptStimulus'),
    })
  }

  return { rows }
}
