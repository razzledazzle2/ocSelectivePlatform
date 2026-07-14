import type { BlankCellBehavior, FieldDiff, QuestionImportRow } from '@/lib/import/types'
import type { ExistingQuestionSnapshot } from '@/lib/questions/queries'

/**
 * Pure blank-cell merge logic for update-mode imports — deliberately free of any runtime `@/`
 * imports (only type-only imports, which are erased by the TS/type-stripping build) so it can
 * be unit-tested directly with `node --test` without a Next.js runtime.
 */

export interface MergeFieldSpec {
  key: keyof QuestionImportRow
  label: string
  /** Never cleared even when blankCellBehavior === 'clear' — a blank cell always keeps the existing value. */
  protectedField: boolean
  /** Value used when clearing a blank cell (defaults to ''). */
  clearValue?: string
  getExisting: (existing: ExistingQuestionSnapshot) => string
}

/** Builds a {"A": "...", ...} JSON string from an existing snapshot's options (or '' when none apply). */
export function existingOptionLabelJson(
  existing: ExistingQuestionSnapshot,
  pick: (option: ExistingQuestionSnapshot['options'][number]) => string | null
): string {
  const entries = existing.options
    .map((option) => [option.label, pick(option)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : ''
}

export const MERGE_FIELDS: MergeFieldSpec[] = [
  { key: 'subject', label: 'Subject', protectedField: true, getExisting: (e) => e.subjectName },
  { key: 'strand', label: 'Strand', protectedField: false, getExisting: (e) => e.strand ?? '' },
  { key: 'topic', label: 'Topic', protectedField: true, getExisting: (e) => e.topicName },
  { key: 'questionType', label: 'Question type', protectedField: false, getExisting: (e) => e.questionTypeName ?? '' },
  { key: 'variantType', label: 'Variant', protectedField: false, getExisting: (e) => e.variantName ?? '' },
  { key: 'examType', label: 'Exam type', protectedField: true, getExisting: (e) => e.examType },
  {
    key: 'yearLevel',
    label: 'Year level',
    protectedField: false,
    getExisting: (e) => (e.yearLevel != null ? String(e.yearLevel) : ''),
  },
  { key: 'difficulty', label: 'Difficulty', protectedField: true, getExisting: (e) => String(e.difficulty) },
  { key: 'marks', label: 'Marks', protectedField: false, getExisting: (e) => String(e.marks) },
  {
    key: 'timeLimitSeconds',
    label: 'Time limit (s)',
    protectedField: false,
    getExisting: (e) => (e.timeLimitSeconds != null ? String(e.timeLimitSeconds) : ''),
  },
  { key: 'answerFormat', label: 'Answer format', protectedField: true, getExisting: (e) => e.answerFormat },
  { key: 'questionText', label: 'Question text', protectedField: true, getExisting: (e) => e.questionText },
  { key: 'passageText', label: 'Passage text', protectedField: false, getExisting: (e) => e.passageText ?? '' },
  {
    key: 'optionAssetRefsJson',
    label: 'Option asset refs',
    protectedField: false,
    getExisting: (e) => existingOptionLabelJson(e, (option) => option.assetRef),
  },
  {
    key: 'optionExplanationsJson',
    label: 'Option explanations',
    protectedField: false,
    getExisting: (e) => existingOptionLabelJson(e, (option) => option.explanation),
  },
  { key: 'correctAnswer', label: 'Correct answer', protectedField: true, getExisting: (e) => e.correctOptionLabel ?? '' },
  { key: 'workedSolution', label: 'Worked solution', protectedField: false, getExisting: (e) => e.workedSolution ?? '' },
  { key: 'inputMethod', label: 'Input method', protectedField: false, getExisting: (e) => e.presentation.inputMethod ?? '' },
  { key: 'displayMode', label: 'Display mode', protectedField: false, getExisting: (e) => e.presentation.displayMode ?? '' },
  {
    key: 'answerValidationJson',
    label: 'Answer validation',
    protectedField: false,
    getExisting: (e) => (e.presentation.answerValidation ? JSON.stringify(e.presentation.answerValidation) : ''),
  },
  {
    key: 'rubricJson',
    label: 'Rubric',
    protectedField: false,
    getExisting: (e) => (e.rubric ? JSON.stringify(e.rubric) : ''),
  },
  { key: 'skillTags', label: 'Skill tags', protectedField: false, getExisting: (e) => e.skillTags.join(', ') },
  { key: 'conceptTags', label: 'Concept tags', protectedField: false, getExisting: (e) => e.conceptTags.join(', ') },
  { key: 'status', label: 'Status', protectedField: false, clearValue: 'draft', getExisting: (e) => e.status },
  { key: 'tags', label: 'Tags', protectedField: false, getExisting: (e) => e.tags.join(', ') },
  { key: 'sourceName', label: 'Source name', protectedField: false, getExisting: (e) => e.sourceInfo.sourceName ?? '' },
  { key: 'sourcePaper', label: 'Source paper', protectedField: false, getExisting: (e) => e.sourceInfo.sourcePaper ?? '' },
  {
    key: 'sourceSection',
    label: 'Source section',
    protectedField: false,
    getExisting: (e) => e.sourceInfo.sourceSection ?? '',
  },
  {
    key: 'sourceQuestionNumber',
    label: 'Source question number',
    protectedField: false,
    getExisting: (e) => e.sourceInfo.sourceQuestionNumber ?? '',
  },
  { key: 'licenseNotes', label: 'License notes', protectedField: false, getExisting: (e) => e.sourceInfo.licenseNotes ?? '' },
  {
    key: 'assetGenerationPrompt',
    label: 'Asset generation prompt',
    protectedField: false,
    getExisting: (e) => e.assetGenerationPrompt ?? '',
  },
  { key: 'assetAltText', label: 'Asset alt text', protectedField: false, getExisting: (e) => e.assetAltText ?? '' },
  {
    key: 'assetSpecJson',
    label: 'Asset spec',
    protectedField: false,
    getExisting: (e) => (e.assetSpec ? JSON.stringify(e.assetSpec) : ''),
  },
  { key: 'assetStatus', label: 'Asset status', protectedField: false, getExisting: (e) => e.assetStatus ?? '' },
  { key: 'domainCode', label: 'Domain', protectedField: false, getExisting: (e) => e.domainCode ?? '' },
  { key: 'subtopicCode', label: 'Subtopic', protectedField: false, getExisting: (e) => e.subtopicCode ?? '' },
  { key: 'skillCode', label: 'Skill', protectedField: false, getExisting: (e) => e.skillCode ?? '' },
  { key: 'patternKey', label: 'Pattern key', protectedField: false, getExisting: (e) => e.patternKey ?? '' },
  { key: 'questionFamily', label: 'Question family', protectedField: false, getExisting: (e) => e.questionFamily ?? '' },
  { key: 'stimulusFormat', label: 'Stimulus format', protectedField: false, getExisting: (e) => e.stimulusFormat ?? '' },
  { key: 'stimulusGenre', label: 'Stimulus genre', protectedField: false, getExisting: (e) => e.stimulusGenre ?? '' },
  {
    key: 'assetRenderMethod',
    label: 'Asset render method',
    protectedField: false,
    getExisting: (e) => e.assetRenderMethod ?? '',
  },
  { key: 'writingForm', label: 'Writing form', protectedField: false, getExisting: (e) => e.writingForm ?? '' },
  { key: 'writingPurpose', label: 'Writing purpose', protectedField: false, getExisting: (e) => e.writingPurpose ?? '' },
  {
    key: 'writingPromptStimulus',
    label: 'Writing prompt stimulus',
    protectedField: false,
    getExisting: (e) => e.writingPromptStimulus ?? '',
  },
]

export function refArrayDiff(field: string, label: string, existingRefs: string[], incomingRefs: string[], finalRefs: string[]): FieldDiff {
  return {
    field,
    label,
    existing: existingRefs.join('; '),
    incoming: incomingRefs.join('; '),
    final: finalRefs.join('; '),
    changed: finalRefs.join('; ') !== existingRefs.join('; '),
  }
}

/**
 * Merges one row's raw cells against an existing question snapshot per the blank-cell policy:
 * a non-blank incoming cell always wins; a blank cell keeps the existing value for "protected"
 * fields (subject/topic/exam type/difficulty/answer format/question text/options/correct
 * answer — a question is never left in a structurally invalid state by a blank cell) and
 * otherwise keeps-or-clears per `blankCellBehavior`. Returns a merged row (so the rest of
 * validation can run unchanged against it) plus the field-level diffs for the preview.
 */
export function mergeRowWithExisting(
  row: QuestionImportRow,
  existing: ExistingQuestionSnapshot,
  blankCellBehavior: BlankCellBehavior
): { mergedRow: QuestionImportRow; diffs: FieldDiff[] } {
  const merged: QuestionImportRow = { ...row }
  const diffs: FieldDiff[] = []

  for (const spec of MERGE_FIELDS) {
    const incoming = String(row[spec.key] ?? '').trim()
    const existingValue = spec.getExisting(existing)
    const keepBlank = spec.protectedField || blankCellBehavior === 'keep'
    const clearValue = spec.clearValue ?? ''
    const final = incoming ? incoming : keepBlank ? existingValue : clearValue
    // Every field on QuestionImportRow this table targets is a plain string.
    ;(merged as unknown as Record<string, string>)[spec.key] = final
    diffs.push({ field: spec.key, label: spec.label, existing: existingValue, incoming, final, changed: final !== existingValue })
  }

  // Options are a protected array: a blank options group means "none supplied", not "clear them".
  const incomingOptionsBlank = row.options.every((option) => !option.trim())
  const existingOptionTexts = existing.options.map((option) => option.text)
  merged.options = incomingOptionsBlank ? existingOptionTexts : row.options
  diffs.push({
    field: 'options',
    label: 'Options',
    existing: existingOptionTexts.join(' | '),
    incoming: row.options.filter((option) => option.trim()).join(' | '),
    final: merged.options.filter((option) => option.trim()).join(' | '),
    changed: merged.options.join(' | ') !== existingOptionTexts.join(' | '),
  })

  // Asset ref arrays are optional/clearable content, not protected.
  const mergeRefArray = (incoming: string[], existingRefs: string[]): string[] =>
    incoming.length > 0 ? incoming : blankCellBehavior === 'keep' ? existingRefs : []

  merged.questionAssetRefs = mergeRefArray(row.questionAssetRefs, existing.questionAssetRefs)
  diffs.push(
    refArrayDiff('question_asset_refs', 'Question asset refs', existing.questionAssetRefs, row.questionAssetRefs, merged.questionAssetRefs)
  )

  merged.solutionAssetRefs = mergeRefArray(row.solutionAssetRefs, existing.solutionAssetRefs)
  diffs.push(
    refArrayDiff('solution_asset_refs', 'Solution asset refs', existing.solutionAssetRefs, row.solutionAssetRefs, merged.solutionAssetRefs)
  )

  const existingStimulusAssetRefs = existing.stimulus?.assetRefs ?? []
  merged.stimulusAssetRefs = mergeRefArray(row.stimulusAssetRefs, existingStimulusAssetRefs)
  diffs.push(
    refArrayDiff('stimulus_asset_refs', 'Stimulus asset refs', existingStimulusAssetRefs, row.stimulusAssetRefs, merged.stimulusAssetRefs)
  )

  // Stimulus link: handled at resolution time via existingStimulusId (a blank cell keeps the
  // existing link under 'keep', unlinks under 'clear') — a synthetic export ref wouldn't
  // resolve as a real external_ref, so we don't rewrite stimulusId here. This is diff-only.
  const existingStimulusLabel = existing.stimulus ? existing.stimulus.externalRef ?? '(linked stimulus)' : ''
  const incomingStimulus = row.stimulusId.trim()
  diffs.push({
    field: 'stimulus_id',
    label: 'Stimulus',
    existing: existingStimulusLabel,
    incoming: incomingStimulus,
    final: incomingStimulus || (blankCellBehavior === 'keep' ? existingStimulusLabel : ''),
    changed: incomingStimulus ? incomingStimulus !== existingStimulusLabel : blankCellBehavior === 'clear' && Boolean(existingStimulusLabel),
  })

  return { mergedRow: merged, diffs }
}
