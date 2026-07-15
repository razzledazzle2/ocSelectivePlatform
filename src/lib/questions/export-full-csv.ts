import type {
  AnswerFormat,
  AssetStatus,
  AssetType,
  QuestionPresentation,
  QuestionSourceInfo,
  WritingRubric,
} from '@/lib/types'

/**
 * Full round-trip CSV export. The header matches the v2 import template
 * exactly, so a file exported here can be re-imported by the CSV parser
 * (stimuli are re-linked by external ref, assets by their refs).
 */
export const FULL_EXPORT_CSV_HEADERS = [
  'external_id',
  'subject',
  'strand',
  'topic',
  'essential_question_type',
  'variant_type',
  'exam_type',
  'year_level',
  'difficulty',
  'marks',
  'time_limit_seconds',
  'answer_format',
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'option_asset_refs_json',
  'option_explanations_json',
  'correct_answer',
  'worked_solution',
  'stimulus_id',
  'stimulus_title',
  'stimulus_type',
  'stimulus_text',
  'stimulus_asset_refs',
  'question_asset_refs',
  'solution_asset_refs',
  'input_method',
  'display_mode',
  'answer_validation_json',
  'rubric_json',
  'skill_tags',
  'concept_tags',
  'tags',
  'source_name',
  'source_paper',
  'source_section',
  'source_question_number',
  'license_notes',
  'asset_generation_prompt',
  'asset_alt_text',
  'asset_spec_json',
  'asset_status',
  'status',
  // Canonical taxonomy v1 (src/lib/taxonomy). Appended so older v2 files still
  // import; codes round-trip losslessly here.
  'domain_code',
  'subtopic_code',
  'skill_code',
  'pattern_key',
  'question_family',
  'stimulus_format',
  'stimulus_genre',
  'asset_render_method',
  'writing_form',
  'writing_purpose',
  'writing_prompt_stimulus',
  // Asset metadata (append-only, mirrors the import template).
  'asset_type',
  'asset_required',
  // Reading question sets (append-only, mirrors the import template).
  'option_f',
  'option_g',
  'question_set_id',
  'question_set_title',
  'question_set_type',
  'question_order_in_set',
  'set_instructions',
  'set_feedback_mode',
  'set_completion_mode',
  'interaction_type',
  'shared_option_pool_id',
  'stimulus_target_label',
  'stimulus_author',
  'stimulus_source_title',
  'stimulus_source_url',
  'stimulus_attribution_text',
] as const

export interface FullExportOption {
  label: string
  text: string
  explanation: string | null
  assetRef: string | null
}

export interface FullExportStimulus {
  id: string
  externalRef: string | null
  title: string
  stimulusType: string
  bodyMarkdown: string | null
  assetRefs: string[]
  /** Attribution stored in stimuli.source_info (optional; round-trips). */
  author?: string | null
  sourceTitle?: string | null
  sourceUrl?: string | null
  attributionText?: string | null
}

/** A question's reading-set membership, for round-trip export (optional). */
export interface FullExportQuestionSet {
  externalRef: string | null
  title: string | null
  setType: string | null
  orderInSet: number | null
  instructions: string | null
  feedbackMode: string | null
  completionMode: string | null
  interactionType: string | null
  sharedOptionPoolRef: string | null
  targetLabel: string | null
}

export interface FullExportQuestion {
  externalId: string | null
  subjectName: string
  strand: string | null
  topicName: string
  questionTypeName: string | null
  variantName: string | null
  examType: string
  yearLevel: number | null
  difficulty: number
  marks: number
  timeLimitSeconds: number | null
  answerFormat: AnswerFormat
  questionText: string
  passageText: string | null
  options: FullExportOption[]
  correctOptionLabel: string | null
  workedSolution: string | null
  stimulus: FullExportStimulus | null
  questionAssetRefs: string[]
  solutionAssetRefs: string[]
  assetGenerationPrompt: string | null
  assetAltText: string | null
  assetSpec: Record<string, unknown> | null
  assetStatus: AssetStatus | null
  assetType: AssetType | null
  /** Null when the row has no asset refs at all; true/false otherwise (defaults true). */
  assetRequired: boolean | null
  presentation: QuestionPresentation
  rubric: WritingRubric | null
  skillTags: string[]
  conceptTags: string[]
  tags: string[]
  sourceInfo: QuestionSourceInfo
  status: string
  // Canonical taxonomy v1 codes (nullable).
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
  /** Reading-set membership; null/absent for standalone questions. */
  questionSet?: FullExportQuestionSet | null
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function optionByLabel(options: FullExportOption[], label: string): FullExportOption | null {
  return options.find((option) => option.label === label) ?? null
}

function buildLabelJson(options: FullExportOption[], pick: (option: FullExportOption) => string | null): string {
  const entries = options
    .map((option) => [option.label, pick(option)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))

  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : ''
}

/** Import/export round-trip key for a stimulus: its external_ref, or a stable id-derived ref. */
export function stimulusExportRef(stimulus: FullExportStimulus): string {
  return stimulus.externalRef ?? `stim-${stimulus.id.replace(/-/g, '').slice(0, 8)}`
}

export function buildFullExportCsv(rows: FullExportQuestion[]): string {
  const emittedStimulusIds = new Set<string>()
  const emittedSetRefs = new Set<string>()

  const lines = [
    FULL_EXPORT_CSV_HEADERS.join(','),
    ...rows.map((row) => {
      const stimulus = row.stimulus
      // Stimulus definition columns are emitted on the FIRST row of each
      // stimulus group only; later rows just carry the ref.
      const isFirstOfGroup = Boolean(stimulus) && !emittedStimulusIds.has(stimulus!.id)
      if (stimulus && isFirstOfGroup) {
        emittedStimulusIds.add(stimulus.id)
      }

      // Reading-set definition columns are emitted once per set, on the first
      // row seen for that set; later member rows carry only the ref + order.
      const set = row.questionSet ?? null
      const setRef = set?.externalRef ?? null
      const isFirstOfSet = Boolean(setRef) && !emittedSetRefs.has(setRef!)
      if (setRef && isFirstOfSet) {
        emittedSetRefs.add(setRef)
      }

      const cells: string[] = [
        row.externalId ?? '',
        row.subjectName,
        row.strand ?? '',
        row.topicName,
        row.questionTypeName ?? '',
        row.variantName ?? '',
        row.examType,
        row.yearLevel === null ? '' : String(row.yearLevel),
        String(row.difficulty),
        String(row.marks),
        row.timeLimitSeconds === null ? '' : String(row.timeLimitSeconds),
        row.answerFormat,
        row.questionText,
        optionByLabel(row.options, 'A')?.text ?? '',
        optionByLabel(row.options, 'B')?.text ?? '',
        optionByLabel(row.options, 'C')?.text ?? '',
        optionByLabel(row.options, 'D')?.text ?? '',
        optionByLabel(row.options, 'E')?.text ?? '',
        buildLabelJson(row.options, (option) => option.assetRef),
        buildLabelJson(row.options, (option) => option.explanation),
        row.correctOptionLabel ?? '',
        row.workedSolution ?? '',
        stimulus ? stimulusExportRef(stimulus) : '',
        stimulus && isFirstOfGroup ? stimulus.title : '',
        stimulus && isFirstOfGroup ? stimulus.stimulusType : '',
        stimulus && isFirstOfGroup ? stimulus.bodyMarkdown ?? '' : '',
        stimulus && isFirstOfGroup ? stimulus.assetRefs.join('; ') : '',
        row.questionAssetRefs.join('; '),
        row.solutionAssetRefs.join('; '),
        row.presentation.inputMethod ?? '',
        row.presentation.displayMode ?? '',
        row.presentation.answerValidation ? JSON.stringify(row.presentation.answerValidation) : '',
        row.rubric ? JSON.stringify(row.rubric) : '',
        row.skillTags.join(', '),
        row.conceptTags.join(', '),
        row.tags.join(', '),
        row.sourceInfo.sourceName ?? '',
        row.sourceInfo.sourcePaper ?? '',
        row.sourceInfo.sourceSection ?? '',
        row.sourceInfo.sourceQuestionNumber ?? '',
        row.sourceInfo.licenseNotes ?? '',
        row.assetGenerationPrompt ?? '',
        row.assetAltText ?? '',
        row.assetSpec ? JSON.stringify(row.assetSpec) : '',
        row.assetStatus ?? '',
        row.status,
        row.domainCode ?? '',
        row.subtopicCode ?? '',
        row.skillCode ?? '',
        row.patternKey ?? '',
        row.questionFamily ?? '',
        row.stimulusFormat ?? '',
        row.stimulusGenre ?? '',
        row.assetRenderMethod ?? '',
        row.writingForm ?? '',
        row.writingPurpose ?? '',
        row.writingPromptStimulus ?? '',
        row.assetType ?? '',
        row.assetRequired === null ? '' : String(row.assetRequired),
        optionByLabel(row.options, 'F')?.text ?? '',
        optionByLabel(row.options, 'G')?.text ?? '',
        setRef ?? '',
        set && isFirstOfSet ? set.title ?? '' : '',
        set && isFirstOfSet ? set.setType ?? '' : '',
        set?.orderInSet === null || set?.orderInSet === undefined ? '' : String(set.orderInSet),
        set && isFirstOfSet ? set.instructions ?? '' : '',
        set && isFirstOfSet ? set.feedbackMode ?? '' : '',
        set && isFirstOfSet ? set.completionMode ?? '' : '',
        set?.interactionType ?? '',
        set?.sharedOptionPoolRef ?? '',
        set?.targetLabel ?? '',
        stimulus && isFirstOfGroup ? stimulus.author ?? '' : '',
        stimulus && isFirstOfGroup ? stimulus.sourceTitle ?? '' : '',
        stimulus && isFirstOfGroup ? stimulus.sourceUrl ?? '' : '',
        stimulus && isFirstOfGroup ? stimulus.attributionText ?? '' : '',
      ]

      return cells.map(escapeCsvCell).join(',')
    }),
  ]

  return `${lines.join('\n')}\n`
}
