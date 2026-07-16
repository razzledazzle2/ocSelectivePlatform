import { findUploadedAssetFile } from '@/lib/import/asset-package'
import { parseOptionAssetRefs } from '@/lib/import/option-asset-refs'
import { mergeRowWithExisting } from '@/lib/import/blank-cell-merge'
import { decideRowAction } from '@/lib/import/row-action'
import { resolveAssetRef } from '@/lib/assets/refs'
import { readImageDimensions } from '@/lib/assets/image-metadata'
import { validateAssetFile } from '@/lib/assets/validate-file'
import { parseTags } from '@/lib/questions/mutations'
import { checkOptionCount, labelsForCount } from '@/lib/questions/option-rules'
import type { ExistingQuestionSnapshot } from '@/lib/questions/queries'
import { parseWritingRubric } from '@/lib/questions/rubric'
import {
  correctAnswerStatus,
  mergeQuestionSetGroups,
  mergeSharedOptionPoolGroups,
} from '@/lib/question-sets/core'
import {
  getSkill,
  getSubtopic,
  isValidDimensionValue,
  resolveDomainCode,
  resolveLegacyTaxonomy,
  resolveSkillCode,
  resolveSubtopicCode,
  type DimensionName,
} from '@/lib/taxonomy'
import {
  ANSWER_FORMATS,
  ASSET_STATUSES,
  ASSET_TYPES,
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  QUESTION_SET_TYPES,
  QUESTION_STATUSES,
  SET_COMPLETION_MODES,
  SET_FEEDBACK_MODES,
  SET_INTERACTION_TYPES,
  STIMULUS_TYPES,
  type AnswerFormat,
  type AssetStatus,
  type AssetType,
  type ExamType,
  type QuestionOptionLabel,
  type QuestionPresentation,
  type QuestionSetType,
  type QuestionSourceInfo,
  type QuestionStatus,
  type SetCompletionMode,
  type SetFeedbackMode,
  type SetInteractionType,
  type SharedOptionPoolOption,
  type StimulusAttribution,
  type StimulusType,
} from '@/lib/types'
import type {
  AssetRefPreview,
  BlankCellBehavior,
  FieldDiff,
  ImportFormat,
  ImportReference,
  ImportRowAction,
  ImportRowIssue,
  ImportSettings,
  ImportValidationResult,
  QuestionImportRow,
  ResolvedImportQuestion,
  ResolvedImportQuestionSet,
  ResolvedImportStimulus,
  ResolvedSharedOptionPool,
  UploadedAssetFile,
  ValidatedImportRow,
} from '@/lib/import/types'

/** The canonical taxonomy codes resolved for one import row. */
interface ResolvedImportTaxonomy {
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

/**
 * Resolves and validates the canonical taxonomy codes on an import row.
 * Precedence: explicit CSV codes → legacy fallback derived from the raw topic
 * value. Unknown or inconsistent codes are dropped with a (non-blocking)
 * warning so a re-import never stores junk and nothing is silently discarded.
 */
function resolveImportTaxonomy(row: QuestionImportRow, warnings: ImportRowIssue[]): ResolvedImportTaxonomy {
  const clean = (value: string): string | null => value.trim() || null

  // Accept EITHER the stable code or the human label for category/subtopic/skill,
  // tolerant of case and spacing (e.g. "Comprehension and Comparison" resolves to
  // `comprehension_comparison`). Keep the raw value so a genuinely unknown taxonomy
  // string is surfaced as a row warning rather than silently dropped.
  const rawDomain = clean(row.domainCode)
  const rawSubtopic = clean(row.subtopicCode)
  const rawSkill = clean(row.skillCode)
  let stimulusGenre = clean(row.stimulusGenre)

  let domainCode = resolveDomainCode(rawDomain)
  let subtopicCode = resolveSubtopicCode(rawSubtopic)
  let skillCode = resolveSkillCode(rawSkill)

  if (rawDomain && !domainCode) {
    warnings.push({ field: 'domain_code', message: `Unknown category "${rawDomain}" ignored.` })
  }
  if (rawSubtopic && !subtopicCode) {
    warnings.push({ field: 'subtopic_code', message: `Unknown subtopic "${rawSubtopic}" ignored.` })
  }
  if (rawSkill && !skillCode) {
    warnings.push({ field: 'skill_code', message: `Unknown skill "${rawSkill}" ignored.` })
  }

  // Legacy fallback: derive from the raw topic so re-imported legacy files that
  // predate canonical codes still classify.
  if (!domainCode || !subtopicCode || !stimulusGenre) {
    const legacy = resolveLegacyTaxonomy(row.topic)
    if (legacy.matched && legacy.mapping) {
      domainCode = domainCode ?? legacy.mapping.domainCode ?? null
      subtopicCode = subtopicCode ?? legacy.mapping.subtopicCode ?? null
      stimulusGenre = stimulusGenre ?? legacy.mapping.stimulusGenre ?? null
    }
  }

  // Auto-fill parents from a more specific code.
  if (skillCode && !subtopicCode) subtopicCode = getSkill(skillCode)?.subtopicCode ?? subtopicCode
  if (subtopicCode && !domainCode) domainCode = getSubtopic(subtopicCode)?.domainCode ?? domainCode

  if (subtopicCode && domainCode && getSubtopic(subtopicCode)?.domainCode !== domainCode) {
    warnings.push({
      field: 'subtopic_code',
      message: `Subtopic "${subtopicCode}" is not in domain "${domainCode}"; keeping the domain only.`,
    })
    subtopicCode = null
  }
  if (skillCode && subtopicCode && getSkill(skillCode)?.subtopicCode !== subtopicCode) {
    warnings.push({
      field: 'skill_code',
      message: `Skill "${skillCode}" is not in subtopic "${subtopicCode}"; dropped.`,
    })
    skillCode = null
  }
  if (stimulusGenre && !isValidDimensionValue('stimulus_genre', stimulusGenre)) {
    warnings.push({ field: 'stimulus_genre', message: `"${stimulusGenre}" is not a valid stimulus genre; ignored.` })
    stimulusGenre = null
  }

  const dimField = (dimension: DimensionName, field: string, raw: string): string | null => {
    const value = clean(raw)
    if (!isValidDimensionValue(dimension, value)) {
      warnings.push({ field, message: `"${value}" is not a valid ${dimension.replace(/_/g, ' ')}; ignored.` })
      return null
    }
    return value
  }

  return {
    domainCode,
    subtopicCode,
    skillCode,
    patternKey: clean(row.patternKey),
    questionFamily: dimField('question_family', 'question_family', row.questionFamily),
    stimulusFormat: dimField('stimulus_format', 'stimulus_format', row.stimulusFormat),
    stimulusGenre,
    assetRenderMethod: dimField('asset_render_method', 'asset_render_method', row.assetRenderMethod),
    writingForm: dimField('writing_form', 'writing_form', row.writingForm),
    writingPurpose: dimField('writing_purpose', 'writing_purpose', row.writingPurpose),
    writingPromptStimulus: dimField('writing_prompt_stimulus', 'writing_prompt_stimulus', row.writingPromptStimulus),
  }
}

/** Parses an asset_spec_json cell into an object, or null when blank/invalid. */
function parseAssetSpec(cell: string): Record<string, unknown> | null {
  const trimmed = cell.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Normalises an asset_status cell to a known status, or null when blank/unknown. */
function parseAssetStatus(cell: string): AssetStatus | null {
  const value = cell.trim().toLowerCase()
  return (ASSET_STATUSES as readonly string[]).includes(value) ? (value as AssetStatus) : null
}

/** Normalises an asset_type cell to a known type, or null when blank/unknown. */
function parseAssetType(cell: string): AssetType | null {
  const value = cell.trim().toLowerCase()
  return (ASSET_TYPES as readonly string[]).includes(value) ? (value as AssetType) : null
}

/** "false"/"0"/"no" (case-insensitive) means optional; anything else — including blank — means required. */
function parseAssetRequired(cell: string): boolean {
  const value = cell.trim().toLowerCase()
  return !['false', '0', 'no'].includes(value)
}

export function normalizeQuestionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeExamType(value: string): ExamType | null {
  const match = EXAM_TYPES.find((exam) => exam.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

function normalizeStimulusType(value: string): StimulusType | null {
  const match = STIMULUS_TYPES.find((type) => type === value.trim().toLowerCase())
  return match ?? null
}

function normalizeSetType(value: string): QuestionSetType | null {
  const match = QUESTION_SET_TYPES.find((type) => type === value.trim().toLowerCase())
  return match ?? null
}

function normalizeFeedbackMode(value: string): SetFeedbackMode | null {
  const match = SET_FEEDBACK_MODES.find((mode) => mode === value.trim().toLowerCase())
  return match ?? null
}

function normalizeCompletionMode(value: string): SetCompletionMode | null {
  const match = SET_COMPLETION_MODES.find((mode) => mode === value.trim().toLowerCase())
  return match ?? null
}

function normalizeInteractionType(value: string): SetInteractionType | null {
  const match = SET_INTERACTION_TYPES.find((type) => type === value.trim().toLowerCase())
  return match ?? null
}

/**
 * Parses a JSON cell keyed by option label ({"A": "...", "B": "..."}).
 * Returns null for an empty cell, and an error flag for anything that is not
 * a flat object of string values keyed A–E.
 */
function parseLabelKeyedJson(cell: string): {
  map: Partial<Record<QuestionOptionLabel, string>> | null
  invalid: boolean
} {
  if (!cell.trim()) {
    return { map: null, invalid: false }
  }

  try {
    const parsed: unknown = JSON.parse(cell)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { map: null, invalid: true }
    }

    const map: Partial<Record<QuestionOptionLabel, string>> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const label = key.trim().toUpperCase()
      if (!QUESTION_OPTION_LABELS.includes(label as QuestionOptionLabel) || typeof value !== 'string') {
        return { map: null, invalid: true }
      }
      if (value.trim()) {
        map[label as QuestionOptionLabel] = value.trim()
      }
    }
    return { map, invalid: false }
  } catch {
    return { map: null, invalid: true }
  }
}

interface ReferenceMaps {
  subjectByKey: Map<string, ImportReference['subjects'][number]>
  topicByKey: Map<string, ImportReference['topics'][number]>
  questionTypeByKey: Map<string, ImportReference['questionTypes'][number]>
  variantByKey: Map<string, ImportReference['questionVariants'][number]>
  existingTags: Set<string>
  existingStimulusRefs: Set<string>
  existingExternalIds: Set<string>
  existingByExternalId: Map<string, ExistingQuestionSnapshot>
}

function buildReferenceMaps(reference: ImportReference): ReferenceMaps {
  const subjectByKey = new Map<string, ImportReference['subjects'][number]>()
  for (const subject of reference.subjects) {
    subjectByKey.set(subject.name.toLowerCase(), subject)
    subjectByKey.set(subject.slug.toLowerCase(), subject)
  }

  const topicByKey = new Map<string, ImportReference['topics'][number]>()
  for (const topic of reference.topics) {
    topicByKey.set(`${topic.subject_id}:${topic.name.toLowerCase()}`, topic)
    topicByKey.set(`${topic.subject_id}:${topic.slug.toLowerCase()}`, topic)
  }

  const questionTypeByKey = new Map<string, ImportReference['questionTypes'][number]>()
  for (const questionType of reference.questionTypes) {
    questionTypeByKey.set(`${questionType.subject_id}:${questionType.name.toLowerCase()}`, questionType)
    questionTypeByKey.set(`${questionType.subject_id}:${questionType.slug.toLowerCase()}`, questionType)
  }

  const variantByKey = new Map<string, ImportReference['questionVariants'][number]>()
  for (const variant of reference.questionVariants) {
    variantByKey.set(`${variant.question_type_id}:${variant.name.toLowerCase()}`, variant)
    variantByKey.set(`${variant.question_type_id}:${variant.slug.toLowerCase()}`, variant)
  }

  return {
    subjectByKey,
    topicByKey,
    questionTypeByKey,
    variantByKey,
    existingTags: new Set(reference.existingTags.map((tag) => tag.trim().toLowerCase())),
    existingStimulusRefs: new Set(reference.existingStimulusRefs),
    existingExternalIds: new Set(reference.existingExternalIds),
    existingByExternalId: reference.existingByExternalId,
  }
}

interface StimulusGroup {
  title: string
  stimulusType: string
  bodyMarkdown: string
  assetRefs: string[]
  hasDefinition: boolean
  attribution: StimulusAttribution | null
}

/**
 * Merges the stimulus definition columns across every row sharing one
 * stimulus ref — the definition may live on any single row of the group.
 */
function buildStimulusGroups(rows: QuestionImportRow[]): Map<string, StimulusGroup> {
  const groups = new Map<string, StimulusGroup>()

  for (const row of rows) {
    const ref = row.stimulusId.trim()
    if (!ref) continue

    const group = groups.get(ref) ?? {
      title: '',
      stimulusType: '',
      bodyMarkdown: '',
      assetRefs: [],
      hasDefinition: false,
      attribution: null,
    }
    if (!group.title && row.stimulusTitle.trim()) group.title = row.stimulusTitle.trim()
    if (!group.stimulusType && row.stimulusType.trim()) group.stimulusType = row.stimulusType.trim()
    if (!group.bodyMarkdown && row.stimulusText.trim()) group.bodyMarkdown = row.stimulusText.trim()
    for (const assetRef of row.stimulusAssetRefs) {
      if (!group.assetRefs.includes(assetRef)) {
        group.assetRefs.push(assetRef)
      }
    }
    // First non-blank attribution across the group wins (definition-anywhere).
    if (!group.attribution) {
      const attribution = buildStimulusAttribution(row)
      if (attribution) group.attribution = attribution
    }
    group.hasDefinition =
      group.hasDefinition || Boolean(group.title || group.stimulusType || group.bodyMarkdown)
    groups.set(ref, group)
  }

  return groups
}

/** Builds a StimulusAttribution from a row's attribution cells, or null when all blank. */
function buildStimulusAttribution(row: QuestionImportRow): StimulusAttribution | null {
  const clean = (value: string): string | undefined => value.trim() || undefined
  const attribution: StimulusAttribution = {
    author: clean(row.stimulusAuthor),
    sourceTitle: clean(row.stimulusSourceTitle),
    sourceUrl: clean(row.stimulusSourceUrl),
    attributionText: clean(row.stimulusAttributionText),
  }
  return Object.values(attribution).some(Boolean) ? attribution : null
}


// -- Asset ref preview classification ----------------------------------------------------------

/** Cap on inlining an uploaded file as a base64 thumbnail in the preview response (keeps it light). */
const PREVIEW_DATA_URI_MAX_BYTES = 512 * 1024

function classifyAssetRef(
  ref: string,
  field: string,
  assetFiles: Map<string, UploadedAssetFile>,
  assetRequired: boolean,
  existingAssetStatus: AssetStatus | null,
  referencedFileKeys: Set<string>
): AssetRefPreview {
  const trimmed = ref.trim()
  const uploaded = assetFiles.size > 0 ? findUploadedAssetFile(assetFiles, trimmed) : null

  if (uploaded) {
    referencedFileKeys.add(uploaded.relativePath.toLowerCase())
    const validation = validateAssetFile(uploaded)
    if (!validation.ok) {
      return { ref: trimmed, field, state: 'invalid', message: validation.reason, sizeBytes: uploaded.size }
    }
    const buffer = validation.sanitizedBuffer ?? uploaded.buffer
    const dimensions = readImageDimensions(buffer)
    return {
      ref: trimmed,
      field,
      state: 'ready',
      sizeBytes: uploaded.size,
      mimeType: validation.mimeType,
      ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
      ...(buffer.length <= PREVIEW_DATA_URI_MAX_BYTES
        ? { previewDataUri: `data:${validation.mimeType};base64,${buffer.toString('base64')}` }
        : {}),
    }
  }

  const resolved = resolveAssetRef(trimmed)
  if (resolved.kind === 'pending') {
    return { ref: trimmed, field, state: assetRequired ? 'pending' : 'not_required' }
  }
  if (resolved.kind === 'public' || resolved.kind === 'external') {
    return { ref: trimmed, field, state: 'ready' }
  }

  // "storage" kind: a bare key. Only treat as missing when an asset package was actually
  // supplied for this run — otherwise trust the pre-existing convention (the admin already
  // uploaded it to the bucket directly), unchanged from the pipeline's prior behaviour.
  if (assetFiles.size > 0) {
    return assetRequired
      ? { ref: trimmed, field, state: 'missing', message: 'Referenced file was not found in the uploaded package.' }
      : { ref: trimmed, field, state: 'not_required' }
  }

  if (existingAssetStatus === 'rejected') {
    return { ref: trimmed, field, state: 'rejected', message: 'The existing asset was rejected during review.' }
  }

  return { ref: trimmed, field, state: 'ready' }
}

interface ValidateOptions {
  format: ImportFormat
  reference: ImportReference
  settings: ImportSettings
  /** Files extracted from an uploaded assets ZIP/package — empty map for a plain CSV/paste import. */
  assetFiles: Map<string, UploadedAssetFile>
}

export function validateQuestionImportRows(rows: QuestionImportRow[], options: ValidateOptions): ImportValidationResult {
  const { settings, assetFiles } = options
  const maps = buildReferenceMaps(options.reference)
  const stimulusGroups = buildStimulusGroups(rows)
  const questionSetGroups = mergeQuestionSetGroups(rows)
  const sharedOptionPoolGroups = mergeSharedOptionPoolGroups(rows)
  const seenExternalIds = new Set<string>()
  const referencedFileKeys = new Set<string>()
  const validatedRows: ValidatedImportRow[] = []

  for (const row of rows) {
    // errors block import; warnings do not.
    const errors: ImportRowIssue[] = []
    const warnings: ImportRowIssue[] = []

    // -- External id (required; the stable update/duplicate key) -----------
    const externalId = row.externalId.trim()
    let isDuplicate = false
    let rowAction: ImportRowAction = 'create'
    let existingSnapshot: ExistingQuestionSnapshot | null = null
    let existingStimulusId: string | null = null
    let diffs: FieldDiff[] = []
    let workingRow = row

    if (!externalId) {
      errors.push({ field: 'external_id', message: 'external_id is required for every row.' })
    } else {
      if (seenExternalIds.has(externalId)) {
        errors.push({ field: 'external_id', message: `external_id "${externalId}" is duplicated within this file.` })
      } else {
        seenExternalIds.add(externalId)
      }

      existingSnapshot = maps.existingByExternalId.get(externalId) ?? null
      isDuplicate = Boolean(existingSnapshot)

      const decision = decideRowAction(settings.mode, Boolean(existingSnapshot), externalId)
      if (decision.action === 'skip_duplicate') {
        rowAction = 'skip_duplicate'
        warnings.push({ field: 'external_id', message: decision.message })
      } else if (decision.action === 'blocked') {
        errors.push({ field: 'external_id', message: decision.message })
      } else if (decision.action === 'update' && existingSnapshot) {
        rowAction = 'update'
        const merge = mergeRowWithExisting(row, existingSnapshot, settings.blankCellBehavior)
        workingRow = merge.mergedRow
        diffs = merge.diffs
        existingStimulusId =
          settings.blankCellBehavior === 'keep' && !row.stimulusId.trim() ? existingSnapshot.stimulusIdRaw : null
      }
    }

    // -- Subject (hard error: cannot be auto-created) -----------------------
    const subject = workingRow.subject ? maps.subjectByKey.get(workingRow.subject.trim().toLowerCase()) ?? null : null
    if (!workingRow.subject.trim()) {
      errors.push({ field: 'subject', message: 'Subject is required.' })
    } else if (!subject) {
      errors.push({ field: 'subject', message: `Subject "${workingRow.subject}" was not found. Create the subject first.` })
    }

    // -- Topic (soft: auto-create or fall back to "General" when enabled) ---
    // topicName/topicId feed ResolvedImportQuestion; a null id means "create".
    let topicId: string | null = null
    let topicName = workingRow.topic.trim()
    const existingTopic =
      subject && topicName ? maps.topicByKey.get(`${subject.id}:${topicName.toLowerCase()}`) ?? null : null

    if (subject) {
      if (existingTopic) {
        topicId = existingTopic.id
        topicName = existingTopic.name
      } else if (!topicName) {
        // No topic given at all.
        if (settings.createMissingTopics) {
          topicName = 'General'
          warnings.push({ field: 'topic', message: 'No topic given — importing under "General".' })
        } else {
          errors.push({ field: 'topic', message: 'Topic is required.' })
        }
      } else {
        // Topic named but not found yet.
        if (settings.createMissingTopics) {
          warnings.push({ field: 'topic', message: `New topic "${topicName}" will be created under ${subject.name}.` })
        } else {
          errors.push({ field: 'topic', message: `Topic "${topicName}" was not found under ${subject.name}.` })
        }
      }
    }

    // -- Question type (optional; soft auto-create) -------------------------
    let questionTypeId: string | null = null
    let questionTypeName: string | null = workingRow.questionType.trim() || null
    const existingType =
      subject && questionTypeName
        ? maps.questionTypeByKey.get(`${subject.id}:${questionTypeName.toLowerCase()}`) ?? null
        : null

    if (subject && questionTypeName) {
      if (existingType) {
        questionTypeId = existingType.id
        questionTypeName = existingType.name
      } else if (settings.createMissingQuestionTypes) {
        warnings.push({
          field: 'question_type',
          message: `New question type "${questionTypeName}" will be created under ${subject.name}.`,
        })
      } else {
        errors.push({
          field: 'question_type',
          message: `Question type "${questionTypeName}" was not found for ${subject.name}.`,
        })
      }
    }

    // -- Variant (optional; resolved under the question type) ---------------
    let variantId: string | null = null
    let variantName: string | null = workingRow.variantType.trim() || null

    if (variantName && !questionTypeName) {
      warnings.push({
        field: 'variant_type',
        message: `Variant "${variantName}" ignored — it needs an essential question type.`,
      })
      variantName = null
    } else if (variantName) {
      const existingVariant = questionTypeId
        ? maps.variantByKey.get(`${questionTypeId}:${variantName.toLowerCase()}`) ?? null
        : null

      if (existingVariant) {
        variantId = existingVariant.id
        variantName = existingVariant.name
      } else if (settings.createMissingQuestionTypes) {
        warnings.push({
          field: 'variant_type',
          message: `New variant "${variantName}" will be created under ${questionTypeName}.`,
        })
      } else {
        warnings.push({
          field: 'variant_type',
          message: `Variant "${variantName}" was not found — importing without a variant.`,
        })
        variantName = null
      }
    }

    // -- Answer format -------------------------------------------------------
    const rawAnswerFormat = workingRow.answerFormat.trim().toLowerCase()
    let answerFormat: AnswerFormat = 'single_choice'
    if (rawAnswerFormat && !ANSWER_FORMATS.includes(rawAnswerFormat as AnswerFormat)) {
      errors.push({
        field: 'answer_format',
        message: `Answer format must be one of ${ANSWER_FORMATS.join(', ')}.`,
      })
    } else if (rawAnswerFormat) {
      answerFormat = rawAnswerFormat as AnswerFormat
    }
    const isSingleChoice = answerFormat === 'single_choice'

    // -- Core content -------------------------------------------------------
    if (!workingRow.questionText.trim()) {
      errors.push({ field: 'question_text', message: 'Question text is required.' })
    }

    // -- Per-option asset refs / explanations (JSON keyed by label) ---------
    const optionAssetRefsParsed = parseOptionAssetRefs(workingRow.optionAssetRefsJson)
    if (optionAssetRefsParsed.invalid) {
      errors.push({
        field: 'option_asset_refs_json',
        message:
          'option_asset_refs_json must be a JSON object keyed by option label, e.g. {"A": "a.png"} or {"A": ["a.png"]}.',
      })
    }
    if (optionAssetRefsParsed.multi.length > 0) {
      warnings.push({
        field: 'option_asset_refs_json',
        message: `Option${optionAssetRefsParsed.multi.length === 1 ? '' : 's'} ${optionAssetRefsParsed.multi.join(', ')} listed multiple assets; only the first is used per option.`,
      })
    }
    const optionExplanationsParsed = parseLabelKeyedJson(workingRow.optionExplanationsJson)
    if (optionExplanationsParsed.invalid) {
      errors.push({
        field: 'option_explanations_json',
        message: 'option_explanations_json must be a JSON object keyed by option label.',
      })
    }
    const optionAssetRefMap = optionAssetRefsParsed.map ?? {}
    const optionExplanationMap = optionExplanationsParsed.map ?? {}

    // -- Options (flexible A–E, subject-aware count rules) ------------------
    let optionTexts = workingRow.options.map((option) => option.trim())

    if (isSingleChoice) {
      // Visual-only options: a label may have an asset ref instead of text —
      // pad the positional list so those labels count as real options.
      const assetLabelIndexes = Object.keys(optionAssetRefMap).map((label) =>
        (QUESTION_OPTION_LABELS as readonly string[]).indexOf(label)
      )
      const highestAssetIndex = Math.max(-1, ...assetLabelIndexes)
      while (optionTexts.length < highestAssetIndex + 1) {
        optionTexts.push('')
      }

      const optionLabels = labelsForCount(optionTexts.length)

      optionTexts.forEach((text, index) => {
        const label = optionLabels[index]
        if (!text && !(label && optionAssetRefMap[label])) {
          errors.push({
            field: `option_${label?.toLowerCase() ?? index + 1}`,
            message: `Option ${label ?? index + 1} is empty.`,
          })
        }
      })

      if (optionTexts.length === 0) {
        errors.push({ field: 'options', message: 'No answer options were parsed for this question.' })
      } else {
        const countCheck = checkOptionCount(subject?.name ?? workingRow.subject, optionTexts.length, answerFormat)
        if (countCheck.error) {
          errors.push({ field: 'options', message: countCheck.error })
        } else if (countCheck.warning) {
          warnings.push({ field: 'options', message: countCheck.warning })
        }
      }

      const filledOptions = optionTexts.map((text) => text.toLowerCase()).filter(Boolean)
      if (new Set(filledOptions).size !== filledOptions.length) {
        errors.push({ field: 'options', message: 'Options must be unique within a question.' })
      }
    } else {
      if (optionTexts.some(Boolean) || Object.keys(optionAssetRefMap).length > 0) {
        errors.push({
          field: 'options',
          message: 'Extended response questions must not have answer options.',
        })
      }
      optionTexts = []
    }

    // -- Correct answer -------------------------------------------------------
    const correctOptionLabel = workingRow.correctAnswer.trim().toUpperCase()
    if (isSingleChoice) {
      const optionLabels = labelsForCount(optionTexts.length)
      const status = correctAnswerStatus(optionTexts, correctOptionLabel, QUESTION_OPTION_LABELS)
      if (status === 'missing') {
        errors.push({ field: 'correct_answer', message: 'Correct answer is required.' })
      } else if (status === 'not_a_label') {
        errors.push({
          field: 'correct_answer',
          message: `Correct answer must be one of ${QUESTION_OPTION_LABELS.join(', ')}.`,
        })
      } else if (status === 'out_of_range') {
        errors.push({
          field: 'correct_answer',
          message: `Correct answer is ${correctOptionLabel} but only ${optionLabels[0]}–${
            optionLabels[optionLabels.length - 1]
          } options were parsed.`,
        })
      }
    } else if (correctOptionLabel) {
      errors.push({
        field: 'correct_answer',
        message: 'Extended response questions must not have a correct answer letter.',
      })
    }

    const examType = normalizeExamType(workingRow.examType)
    if (!workingRow.examType.trim()) {
      errors.push({ field: 'exam_type', message: 'Exam type is required (OC or Selective).' })
    } else if (!examType) {
      errors.push({ field: 'exam_type', message: 'Exam type must be OC or Selective.' })
    }

    const difficulty = Number(workingRow.difficulty)
    if (!workingRow.difficulty.trim() || Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push({ field: 'difficulty', message: 'Difficulty must be a number from 1 to 5.' })
    }

    let yearLevel: number | null = null
    if (workingRow.yearLevel.trim()) {
      const parsedYear = Number(workingRow.yearLevel)
      if (Number.isNaN(parsedYear) || parsedYear < 3 || parsedYear > 12) {
        errors.push({ field: 'year_level', message: 'Year level must be between 3 and 12 when provided.' })
      } else {
        yearLevel = parsedYear
      }
    }

    let marks = 1
    if (workingRow.marks.trim()) {
      const parsedMarks = Number(workingRow.marks)
      if (!Number.isInteger(parsedMarks) || parsedMarks < 1) {
        errors.push({ field: 'marks', message: 'Marks must be a positive whole number when provided.' })
      } else {
        marks = parsedMarks
      }
    }

    let timeLimitSeconds: number | null = null
    if (workingRow.timeLimitSeconds.trim()) {
      const parsedTimeLimit = Number(workingRow.timeLimitSeconds)
      if (!Number.isInteger(parsedTimeLimit) || parsedTimeLimit < 1) {
        errors.push({
          field: 'time_limit_seconds',
          message: 'Time limit must be a positive whole number of seconds when provided.',
        })
      } else {
        timeLimitSeconds = parsedTimeLimit
      }
    }

    // -- Rubric (required for extended response) -----------------------------
    const { rubric, error: rubricError } = parseWritingRubric(workingRow.rubricJson)
    if (!isSingleChoice && !workingRow.rubricJson.trim()) {
      errors.push({
        field: 'rubric_json',
        message: 'Extended response questions need a rubric_json with at least one marking criterion.',
      })
    } else if (rubricError) {
      errors.push({ field: 'rubric_json', message: rubricError })
    }

    // -- Worked solution: the single authoritative explanation ---------------
    const workedSolution = workingRow.workedSolution.trim()
    // short_explanation is deprecated. It is no longer stored on its own column;
    // a legacy CSV's value is folded into the worked solution on import.
    const shortExplanation = workingRow.shortExplanation.trim() || null
    if (isSingleChoice && !workedSolution && !shortExplanation) {
      warnings.push({ field: 'solution', message: 'No worked solution — students will not see a full explanation.' })
    }
    if (shortExplanation) {
      warnings.push({
        field: 'short_explanation',
        message: workedSolution
          ? 'short_explanation is deprecated and was ignored — the worked solution is used instead.'
          : 'short_explanation is deprecated — its text was moved into the worked solution.',
      })
    }

    // -- Stimulus (grouped by external ref; definition may be on any row) ---
    const stimulusExternalRef = workingRow.stimulusId.trim() || null
    let stimulusDefinition: ResolvedImportStimulus | null = null
    if (stimulusExternalRef) {
      const group = stimulusGroups.get(stimulusExternalRef)
      const existsInDb = maps.existingStimulusRefs.has(stimulusExternalRef)

      if (group?.hasDefinition && existsInDb) {
        warnings.push({
          field: 'stimulus_id',
          message: `Stimulus "${stimulusExternalRef}" already exists in the bank — the existing stimulus will be reused and the CSV stimulus text ignored.`,
        })
      } else if (group?.hasDefinition) {
        const stimulusType = normalizeStimulusType(group.stimulusType)
        if (!stimulusType) {
          errors.push({
            field: 'stimulus_type',
            message: group.stimulusType
              ? `Stimulus type "${group.stimulusType}" must be one of ${STIMULUS_TYPES.join(', ')}.`
              : `Stimulus "${stimulusExternalRef}" needs a stimulus_type (${STIMULUS_TYPES.join(', ')}).`,
          })
        } else {
          stimulusDefinition = {
            externalRef: stimulusExternalRef,
            title: group.title || stimulusExternalRef,
            stimulusType,
            bodyMarkdown: group.bodyMarkdown || null,
            assetRefs: group.assetRefs,
            attribution: group.attribution,
          }
        }
      } else if (!existsInDb) {
        errors.push({
          field: 'stimulus_id',
          message: `Stimulus "${stimulusExternalRef}" is not defined in this file and was not found in the bank.`,
        })
      }
    }

    // -- Reading question set (grouped by question_set_id; optional) ---------
    const questionSetExternalRef = workingRow.questionSetId.trim() || null
    let questionSetDefinition: ResolvedImportQuestionSet | null = null
    let questionOrderInSet: number | null = null
    if (questionSetExternalRef) {
      const setGroup = questionSetGroups.get(questionSetExternalRef)

      // question_order_in_set: optional, but must be a positive integer if given.
      if (workingRow.questionOrderInSet.trim()) {
        const parsedOrder = Number(workingRow.questionOrderInSet)
        if (!Number.isInteger(parsedOrder) || parsedOrder < 1) {
          errors.push({
            field: 'question_order_in_set',
            message: 'question_order_in_set must be a positive whole number.',
          })
        } else {
          questionOrderInSet = parsedOrder
        }
      }

      const setType = normalizeSetType(setGroup?.setType ?? '')
      if (setGroup?.setType && !setType) {
        errors.push({
          field: 'question_set_type',
          message: `question_set_type "${setGroup.setType}" must be one of ${QUESTION_SET_TYPES.join(', ')}.`,
        })
      }
      const feedbackMode = normalizeFeedbackMode(setGroup?.feedbackMode ?? '')
      if (setGroup?.feedbackMode && !feedbackMode) {
        errors.push({
          field: 'set_feedback_mode',
          message: `set_feedback_mode "${setGroup.feedbackMode}" must be one of ${SET_FEEDBACK_MODES.join(', ')}.`,
        })
      }
      const completionMode = normalizeCompletionMode(setGroup?.completionMode ?? '')
      if (setGroup?.completionMode && !completionMode) {
        errors.push({
          field: 'set_completion_mode',
          message: `set_completion_mode "${setGroup.completionMode}" must be one of ${SET_COMPLETION_MODES.join(', ')}.`,
        })
      }
      const interactionType = normalizeInteractionType(setGroup?.interactionType ?? '')
      if (setGroup?.interactionType && !interactionType) {
        errors.push({
          field: 'interaction_type',
          message: `interaction_type "${setGroup.interactionType}" must be one of ${SET_INTERACTION_TYPES.join(', ')}.`,
        })
      }

      questionSetDefinition = {
        externalRef: questionSetExternalRef,
        title: setGroup?.title || questionSetExternalRef,
        setType: setType ?? 'reading_passage',
        instructions: setGroup?.instructions || null,
        // Reading sets default to after_set (delayed) feedback.
        feedbackMode: feedbackMode ?? 'after_set',
        completionMode: completionMode ?? 'free_navigation',
        interactionType: interactionType ?? null,
        stimulusExternalRef: setGroup?.stimulusExternalRef || stimulusExternalRef,
        sharedOptionPoolRef: setGroup?.sharedOptionPoolRef || (workingRow.sharedOptionPoolId.trim() || null),
      }
    } else if (workingRow.questionOrderInSet.trim() || workingRow.sharedOptionPoolId.trim()) {
      warnings.push({
        field: 'question_set_id',
        message:
          'question_order_in_set / shared_option_pool_id were given without a question_set_id — they will be ignored.',
      })
    }

    // -- Shared option pool (sentence insertion; optional) ------------------
    const sharedOptionPoolRef = workingRow.sharedOptionPoolId.trim() || null
    let sharedOptionPoolDefinition: ResolvedSharedOptionPool | null = null
    if (sharedOptionPoolRef) {
      const poolGroup = sharedOptionPoolGroups.get(sharedOptionPoolRef)
      const poolTexts = poolGroup?.optionTexts ?? []
      if (poolTexts.filter(Boolean).length === 0) {
        errors.push({
          field: 'shared_option_pool_id',
          message: `Shared option pool "${sharedOptionPoolRef}" has no options — add option_a…option_g on one of its rows.`,
        })
      } else {
        const poolLabels = labelsForCount(poolTexts.length)
        const poolOptions: SharedOptionPoolOption[] = poolTexts.map((text, index) => ({
          label: poolLabels[index] as QuestionOptionLabel,
          text,
        }))
        sharedOptionPoolDefinition = {
          externalRef: sharedOptionPoolRef,
          title: poolGroup?.title || null,
          options: poolOptions,
        }
      }
    }
    const stimulusTargetLabel = workingRow.stimulusTargetLabel.trim() || null

    // -- Presentation hints ---------------------------------------------------
    const presentation: QuestionPresentation = {}
    if (workingRow.inputMethod.trim()) {
      presentation.inputMethod = workingRow.inputMethod.trim()
    }
    if (workingRow.displayMode.trim()) {
      presentation.displayMode = workingRow.displayMode.trim()
    }
    if (workingRow.answerValidationJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(workingRow.answerValidationJson)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('not an object')
        }
        presentation.answerValidation = parsed as Record<string, unknown>
      } catch {
        errors.push({
          field: 'answer_validation_json',
          message: 'answer_validation_json must be a JSON object.',
        })
      }
    }

    // -- Provenance -----------------------------------------------------------
    const sourceInfo: QuestionSourceInfo = {}
    if (workingRow.sourceName.trim()) sourceInfo.sourceName = workingRow.sourceName.trim()
    if (workingRow.sourcePaper.trim()) sourceInfo.sourcePaper = workingRow.sourcePaper.trim()
    if (workingRow.sourceSection.trim()) sourceInfo.sourceSection = workingRow.sourceSection.trim()
    if (workingRow.sourceQuestionNumber.trim()) sourceInfo.sourceQuestionNumber = workingRow.sourceQuestionNumber.trim()
    if (workingRow.licenseNotes.trim()) sourceInfo.licenseNotes = workingRow.licenseNotes.trim()

    // -- Tags (soft: brand-new tags are a heads-up, never blocking) ---------
    const tags = parseTags(workingRow.tags)
    const skillTags = parseTags(workingRow.skillTags)
    const conceptTags = parseTags(workingRow.conceptTags)
    const newTags = tags.filter((tag) => !maps.existingTags.has(tag.toLowerCase()))
    if (newTags.length > 0) {
      warnings.push({ field: 'tags', message: `New tag${newTags.length === 1 ? '' : 's'}: ${newTags.join(', ')}.` })
    }

    // -- Status -------------------------------------------------------------
    const rawStatus = workingRow.status.trim().toLowerCase()
    if (rawStatus && !QUESTION_STATUSES.includes(rawStatus as QuestionStatus)) {
      warnings.push({ field: 'status', message: `Unknown status "${workingRow.status}" ignored.` })
    }
    // Create rows always land on the uniform admin setting (review-first draft by default).
    // Update rows respect the merged per-row status so a re-import never silently reverts a
    // published question back to draft.
    const resolvedStatus: QuestionStatus =
      rowAction === 'update' && rawStatus && QUESTION_STATUSES.includes(rawStatus as QuestionStatus)
        ? (rawStatus as QuestionStatus)
        : settings.importStatus

    // Question wording is intentionally NOT checked for duplication. Identical text with a
    // different external_id (e.g. the same prompt asked of a different passage) is a distinct
    // question and must import. Identity is external_id only — enforced above and by the DB.

    const isImportable = errors.length === 0

    const taxonomy = resolveImportTaxonomy(workingRow, warnings)
    const assetType = parseAssetType(workingRow.assetType)
    const assetRequired = parseAssetRequired(workingRow.assetRequired)

    const optionLabels = labelsForCount(optionTexts.length)
    const resolved: ResolvedImportQuestion | null =
      isImportable && subject && examType
        ? {
            // rowAction is only 'create' | 'update' | 'skip_duplicate' at this point ('unchanged'
            // is decided afterwards, once every diff has been computed).
            action: rowAction === 'skip_duplicate' ? 'create' : (rowAction as 'create' | 'update'),
            existingQuestionId: existingSnapshot?.questionId ?? null,
            externalId,
            subjectId: subject.id,
            topicId,
            topicName,
            strand: workingRow.strand.trim() || null,
            questionTypeId,
            questionTypeName,
            variantId,
            variantName,
            examType,
            difficulty,
            yearLevel,
            marks,
            timeLimitSeconds,
            answerFormat,
            questionText: workingRow.questionText.trim(),
            passageText: workingRow.passageText.trim() || null,
            options: optionTexts,
            optionAssetRefs: optionLabels.map((label) => optionAssetRefMap[label] ?? null),
            optionExplanations: optionLabels.map((label) => optionExplanationMap[label] ?? null),
            correctOptionLabel: isSingleChoice ? (correctOptionLabel as QuestionOptionLabel) : null,
            workedSolution,
            shortExplanation,
            stimulusExternalRef,
            stimulusDefinition,
            existingStimulusId,
            questionAssetRefs: workingRow.questionAssetRefs,
            solutionAssetRefs: workingRow.solutionAssetRefs,
            rubric,
            presentation,
            sourceInfo,
            assetGenerationPrompt: workingRow.assetGenerationPrompt.trim() || null,
            assetAltText: workingRow.assetAltText.trim() || null,
            assetSpec: parseAssetSpec(workingRow.assetSpecJson),
            assetStatus: parseAssetStatus(workingRow.assetStatus),
            assetType,
            assetRequired,
            tags,
            skillTags,
            conceptTags,
            status: resolvedStatus,
            ...taxonomy,
            questionSetExternalRef,
            questionSetDefinition,
            questionOrderInSet,
            stimulusTargetLabel,
            sharedOptionPoolRef,
            sharedOptionPoolDefinition,
          }
        : null

    // "unchanged" is only meaningful once every field has had its chance to diff.
    if (rowAction === 'update' && diffs.length > 0 && !diffs.some((diff) => diff.changed)) {
      rowAction = 'unchanged'
    }

    // -- Asset ref preview (missing/pending/invalid/rejected/ready) ---------
    const assetPreviews: AssetRefPreview[] = []
    const existingAssetStatus = rowAction !== 'create' ? existingSnapshot?.assetStatus ?? null : null
    for (const ref of workingRow.questionAssetRefs) {
      assetPreviews.push(classifyAssetRef(ref, 'question_asset_refs', assetFiles, assetRequired, existingAssetStatus, referencedFileKeys))
    }
    for (const ref of workingRow.solutionAssetRefs) {
      assetPreviews.push(classifyAssetRef(ref, 'solution_asset_refs', assetFiles, assetRequired, null, referencedFileKeys))
    }
    for (const ref of workingRow.stimulusAssetRefs) {
      assetPreviews.push(classifyAssetRef(ref, 'stimulus_asset_refs', assetFiles, assetRequired, null, referencedFileKeys))
    }
    for (const [label, ref] of Object.entries(optionAssetRefMap)) {
      assetPreviews.push(classifyAssetRef(ref, `option_asset_refs_json.${label}`, assetFiles, assetRequired, null, referencedFileKeys))
    }

    const rowStatus = !isImportable ? 'error' : warnings.length > 0 ? 'warning' : 'ready'

    validatedRows.push({
      rowNumber: row.rowNumber,
      rowStatus,
      action: rowAction,
      questionPreview: workingRow.questionText.trim() || '(missing question text)',
      subjectLabel: subject?.name ?? (workingRow.subject || '—'),
      topicLabel: topicName || '—',
      questionTypeLabel: questionTypeName ?? 'Untagged',
      statusLabel: resolvedStatus,
      optionsCount: optionTexts.length,
      correctAnswerLabel: correctOptionLabel || '—',
      errors,
      warnings,
      isDuplicate,
      isImportable,
      resolved,
      diffs,
      assetPreviews,
    })
  }

  const unusedAssetFiles = [...assetFiles.entries()]
    .filter(([key]) => !referencedFileKeys.has(key))
    .map(([, file]) => file.relativePath)

  return {
    format: options.format,
    totalRows: validatedRows.length,
    importableCount: validatedRows.filter((row) => row.isImportable).length,
    readyCount: validatedRows.filter((row) => row.rowStatus === 'ready').length,
    warningCount: validatedRows.filter((row) => row.warnings.length > 0).length,
    errorCount: validatedRows.filter((row) => !row.isImportable).length,
    duplicateCount: validatedRows.filter((row) => row.isDuplicate).length,
    createCount: validatedRows.filter((row) => row.isImportable && row.action === 'create').length,
    updateCount: validatedRows.filter((row) => row.isImportable && row.action === 'update').length,
    unchangedCount: validatedRows.filter((row) => row.isImportable && row.action === 'unchanged').length,
    missingAssetCount: validatedRows.reduce(
      (sum, row) => sum + row.assetPreviews.filter((preview) => preview.state === 'missing').length,
      0
    ),
    invalidAssetCount: validatedRows.reduce(
      (sum, row) => sum + row.assetPreviews.filter((preview) => preview.state === 'invalid').length,
      0
    ),
    resolvedAssetCount: validatedRows.reduce(
      (sum, row) => sum + row.assetPreviews.filter((preview) => preview.state === 'ready').length,
      0
    ),
    uploadedFileCount: assetFiles.size,
    unusedAssetFiles,
    rows: validatedRows,
  }
}
