import { findUploadedAssetFile } from '@/lib/import/asset-package'
import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion, UploadedAssetFile } from '@/lib/import/types'
import { resolveAssetGeneration } from '@/lib/assets/generate'
import { ensureAssetByExternalRef, linkAssetToQuestion } from '@/lib/assets/mutations'
import { uploadQuestionAsset, validateAssetFile } from '@/lib/assets/upload'
import { archiveQuestion, updateQuestion } from '@/lib/questions/mutations'
import { labelsForCount } from '@/lib/questions/option-rules'
import { slugify } from '@/lib/questions/slug'
import { ensureQuestionType, ensureQuestionVariant, ensureTopic } from '@/lib/questions/taxonomy-mutations'
import { ensureStimulusByExternalRef } from '@/lib/stimuli/mutations'
import { createClient } from '@/lib/supabase/server'
import type { QuestionOptionRecord, QuestionSource, QuestionWriteInput } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function buildQuestionPayload(
  row: ResolvedImportQuestion,
  topicId: string,
  questionTypeId: string | null,
  variantId: string | null,
  stimulusId: string | null,
  actorId: string,
  source: QuestionSource
) {
  const now = new Date().toISOString()
  return {
    external_id: row.externalId,
    subject_id: row.subjectId,
    topic_id: topicId,
    question_type_id: questionTypeId,
    variant_id: variantId,
    exam_type: row.examType,
    year_level: row.yearLevel,
    difficulty: row.difficulty,
    marks: row.marks,
    time_limit_seconds: row.timeLimitSeconds,
    answer_format: row.answerFormat,
    question_text: row.questionText,
    passage_text: row.passageText,
    stimulus_id: stimulusId,
    short_explanation: row.shortExplanation,
    worked_solution: row.workedSolution || null,
    correct_option_label: row.correctOptionLabel,
    rubric: row.rubric,
    presentation: row.presentation,
    source_info: row.sourceInfo,
    status: row.status,
    source,
    tags: row.tags,
    skill_tags: row.skillTags,
    concept_tags: row.conceptTags,
    domain_code: row.domainCode,
    subtopic_code: row.subtopicCode,
    skill_code: row.skillCode,
    pattern_key: row.patternKey,
    question_family: row.questionFamily,
    stimulus_format: row.stimulusFormat,
    stimulus_genre: row.stimulusGenre,
    asset_render_method: row.assetRenderMethod,
    writing_form: row.writingForm,
    writing_purpose: row.writingPurpose,
    writing_prompt_stimulus: row.writingPromptStimulus,
    created_by: actorId,
    updated_by: actorId,
    published_at: row.status === 'published' ? now : null,
    archived_at: row.status === 'archived' ? now : null,
  }
}

/**
 * Resolves the topic id for a row, creating the topic (and caching it) when the
 * row arrived with a null topicId. Cache key is (subjectId, slug) to match the
 * DB unique constraint and to dedupe repeated names within one import.
 */
async function resolveTopicId(
  supabase: SupabaseServerClient,
  row: ResolvedImportQuestion,
  cache: Map<string, string>,
  created: Set<string>
): Promise<string> {
  if (row.topicId) {
    return row.topicId
  }
  const key = `${row.subjectId}:${slugify(row.topicName)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const before = created.has(key)
  const id = await ensureTopic(supabase, row.subjectId, row.topicName, row.strand)
  cache.set(key, id)
  if (!before) {
    created.add(key)
  }
  return id
}

async function resolveQuestionTypeId(
  supabase: SupabaseServerClient,
  row: ResolvedImportQuestion,
  topicId: string,
  cache: Map<string, string>,
  created: Set<string>
): Promise<string | null> {
  if (row.questionTypeId) {
    return row.questionTypeId
  }
  if (!row.questionTypeName) {
    return null
  }
  const key = `${row.subjectId}:${slugify(row.questionTypeName)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const id = await ensureQuestionType(supabase, row.subjectId, topicId, row.questionTypeName)
  cache.set(key, id)
  created.add(key)
  return id
}

async function resolveVariantId(
  supabase: SupabaseServerClient,
  row: ResolvedImportQuestion,
  questionTypeId: string | null,
  cache: Map<string, string>,
  created: Set<string>
): Promise<string | null> {
  if (row.variantId) {
    return row.variantId
  }
  if (!row.variantName || !questionTypeId) {
    return null
  }
  const key = `${questionTypeId}:${slugify(row.variantName)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const id = await ensureQuestionVariant(supabase, questionTypeId, row.variantName)
  cache.set(key, id)
  created.add(key)
  return id
}

interface AssetCounters {
  createdAssetCount: number
  generatedAssetCount: number
  uploadedAssetCount: number
  rejectedAssetCount: number
  assetWarnings: string[]
}

/**
 * Builds the shared "ensure an asset row for this ref" helper used by both create and update
 * rows. When the ref matches a file from an uploaded ZIP package, it's validated (extension/
 * MIME/size/SVG-sanitised) and uploaded to the existing `question-media` bucket first; an
 * invalid file is recorded as a rejected asset (never blocks the question import — it stays a
 * draft with a rejected/pending asset, exactly like a hand-authored one would). Otherwise this
 * falls back to the existing deterministic-generation / pending / external / bare-key handling.
 */
function createAssetEnsurer(actorId: string, assetFiles: Map<string, UploadedAssetFile>, importBatchId: string) {
  const assetCache = new Map<string, string>()
  const uploadedPathCache = new Map<string, string>()
  const counters: AssetCounters = {
    createdAssetCount: 0,
    generatedAssetCount: 0,
    uploadedAssetCount: 0,
    rejectedAssetCount: 0,
    assetWarnings: [],
  }

  const ensureRowAsset = async (
    row: ResolvedImportQuestion,
    ref: string,
    options: { primary?: boolean } = {}
  ): Promise<string> => {
    const uploaded = assetFiles.size > 0 ? findUploadedAssetFile(assetFiles, ref) : null

    if (uploaded) {
      const validation = validateAssetFile(uploaded)
      if (!validation.ok) {
        counters.rejectedAssetCount += 1
        counters.assetWarnings.push(`${ref}: ${validation.reason}`)
        const { id, created } = await ensureAssetByExternalRef({
          ref,
          altText: row.assetAltText,
          generationPrompt: row.assetGenerationPrompt,
          status: 'rejected',
          assetType: row.assetType,
          actorId,
          cache: assetCache,
        })
        if (created) counters.createdAssetCount += 1
        return id
      }

      const cacheKey = uploaded.relativePath.toLowerCase()
      let storagePath = uploadedPathCache.get(cacheKey)
      if (!storagePath) {
        const buffer = validation.sanitizedBuffer ?? uploaded.buffer
        storagePath = await uploadQuestionAsset(importBatchId, uploaded.relativePath, buffer, validation.mimeType)
        uploadedPathCache.set(cacheKey, storagePath)
        counters.uploadedAssetCount += 1
      }
      const { id, created } = await ensureAssetByExternalRef({
        ref: storagePath,
        altText: row.assetAltText,
        generationPrompt: row.assetGenerationPrompt,
        status: 'uploaded',
        assetType: validation.assetType,
        actorId,
        cache: assetCache,
      })
      if (created) counters.createdAssetCount += 1
      return id
    }

    const generation = await resolveAssetGeneration({
      ref,
      ownSpec: options.primary ? row.assetSpec : null,
    })
    if (!generation.generated && options.primary && generation.pendingReason) {
      counters.assetWarnings.push(`${ref}: ${generation.pendingReason}`)
    }
    const { id, created } = await ensureAssetByExternalRef({
      ref: generation.generated ? generation.ref : ref,
      altText: row.assetAltText,
      generationPrompt: row.assetGenerationPrompt,
      spec: generation.spec ?? (options.primary ? row.assetSpec : null),
      status: generation.generated ? 'generated' : row.assetStatus,
      assetType: generation.generated ? generation.assetType : row.assetType,
      actorId,
      cache: assetCache,
    })
    if (created) {
      counters.createdAssetCount += 1
      if (generation.generated) {
        counters.generatedAssetCount += 1
      }
    }
    return id
  }

  return { ensureRowAsset, counters, assetCache }
}

function buildOptionRecords(row: ResolvedImportQuestion, optionAssetIds: Array<string | null>): QuestionOptionRecord[] {
  const labels = labelsForCount(row.options.length)
  return row.options.map((text, index) => ({
    label: labels[index],
    option_text: text,
    sort_order: index + 1,
    asset_id: optionAssetIds[index] ?? null,
    explanation: row.optionExplanations[index] ?? null,
  }))
}

function emptySummary(): ImportSummary {
  return {
    importedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    skippedDuplicateCount: 0,
    createdTopicCount: 0,
    createdQuestionTypeCount: 0,
    createdVariantCount: 0,
    createdStimulusCount: 0,
    createdAssetCount: 0,
    generatedAssetCount: 0,
    uploadedAssetCount: 0,
    rejectedAssetCount: 0,
    failedCount: 0,
    assetWarnings: [],
    unusedAssetFiles: [],
  }
}

/**
 * Inserts (action === 'create') or updates (action === 'update') validated import rows,
 * auto-creating any missing topics/question types/variants, shared stimuli and (possibly
 * pending/rejected) assets along the way — all deduped within the run. Never deletes or
 * touches a question that is simply absent from the file; update rows only ever change the
 * question whose external_id matched.
 */
export async function applyValidatedImport(
  rows: ResolvedImportQuestion[],
  actorId: string,
  source: QuestionSource,
  assetFiles: Map<string, UploadedAssetFile>,
  importBatchId: string
): Promise<{ summary: ImportSummary; importedQuestionIds: string[]; updatedQuestionIds: string[] }> {
  const supabase = await createClient()
  const importedQuestionIds: string[] = []
  const updatedQuestionIds: string[] = []
  const summary = emptySummary()

  if (rows.length === 0) {
    return { summary, importedQuestionIds, updatedQuestionIds }
  }

  const createRows = rows.filter((row) => row.action === 'create')
  const updateRows = rows.filter((row) => row.action === 'update')

  const [{ data: existing, error: existingError }, { data: existingIds, error: existingIdsError }] = await Promise.all([
    supabase.from('questions').select('question_text'),
    supabase.from('questions').select('external_id').not('external_id', 'is', null),
  ])
  if (existingError || existingIdsError) {
    throw new Error('Unable to verify existing questions before import.')
  }
  const existingKeys = new Set(
    ((existing ?? []) as Array<{ question_text: string }>).map((row) => normalizeQuestionText(row.question_text))
  )
  const existingExternalIds = new Set(
    ((existingIds ?? []) as Array<{ external_id: string | null }>)
      .map((row) => row.external_id)
      .filter((externalId): externalId is string => Boolean(externalId))
  )

  const topicCache = new Map<string, string>()
  const typeCache = new Map<string, string>()
  const variantCache = new Map<string, string>()
  const stimulusCache = new Map<string, string>()
  const { ensureRowAsset, counters, assetCache } = createAssetEnsurer(actorId, assetFiles, importBatchId)
  const createdTopics = new Set<string>()
  const createdTypes = new Set<string>()
  const createdVariants = new Set<string>()
  let createdStimulusCount = 0

  const resolveOptionAssetIds = async (row: ResolvedImportQuestion): Promise<Array<string | null>> => {
    const optionAssetIds: Array<string | null> = []
    for (const assetRef of row.optionAssetRefs) {
      optionAssetIds.push(assetRef ? await ensureRowAsset(row, assetRef) : null)
    }
    return optionAssetIds
  }

  const resolveStimulusId = async (row: ResolvedImportQuestion): Promise<string | null> => {
    if (row.stimulusExternalRef) {
      const ensured = await ensureStimulusByExternalRef({
        externalRef: row.stimulusExternalRef,
        title: row.stimulusDefinition?.title ?? row.stimulusExternalRef,
        stimulusType: row.stimulusDefinition?.stimulusType ?? 'passage',
        bodyMarkdown: row.stimulusDefinition?.bodyMarkdown ?? null,
        assetRefs: row.stimulusDefinition?.assetRefs,
        assetAltText: row.assetAltText,
        assetGenerationPrompt: row.assetGenerationPrompt,
        actorId,
        cache: stimulusCache,
        assetCache,
      })
      if (ensured.created) {
        createdStimulusCount += 1
      }
      counters.createdAssetCount += ensured.createdAssetCount
      return ensured.id
    }
    // Blank stimulus cell: keep the existing link ('keep' mode) or drop it ('clear' mode /
    // create rows, which never have one) — decided already at validation time.
    return row.existingStimulusId
  }

  const linkQuestionAssets = async (questionId: string, row: ResolvedImportQuestion): Promise<void> => {
    // The row-level asset_spec_json belongs to the question's single main diagram; only pair
    // it when there is exactly one question asset ref.
    const primaryQuestionAsset = row.questionAssetRefs.length === 1
    for (let index = 0; index < row.questionAssetRefs.length; index += 1) {
      const assetId = await ensureRowAsset(row, row.questionAssetRefs[index], { primary: primaryQuestionAsset })
      await linkAssetToQuestion(questionId, assetId, 'question', index + 1)
    }
    for (let index = 0; index < row.solutionAssetRefs.length; index += 1) {
      const assetId = await ensureRowAsset(row, row.solutionAssetRefs[index])
      await linkAssetToQuestion(questionId, assetId, 'solution', index + 1)
    }
  }

  for (const row of createRows) {
    const key = normalizeQuestionText(row.questionText)
    if (existingKeys.has(key) || (row.externalId && existingExternalIds.has(row.externalId))) {
      // Guards against inserting the SAME text or external id twice within one run.
      summary.skippedDuplicateCount += 1
      continue
    }

    try {
      const topicId = await resolveTopicId(supabase, row, topicCache, createdTopics)
      const questionTypeId = await resolveQuestionTypeId(supabase, row, topicId, typeCache, createdTypes)
      const variantId = await resolveVariantId(supabase, row, questionTypeId, variantCache, createdVariants)
      const stimulusId = await resolveStimulusId(row)
      const optionAssetIds = await resolveOptionAssetIds(row)

      const { data: inserted, error: insertError } = await supabase
        .from('questions')
        .insert(buildQuestionPayload(row, topicId, questionTypeId, variantId, stimulusId, actorId, source))
        .select('id')
        .single()

      if (insertError || !inserted) {
        summary.failedCount += 1
        continue
      }

      if (row.options.length > 0) {
        const { error: optionsError } = await supabase
          .from('question_options')
          .insert(buildOptionRecords(row, optionAssetIds).map((option) => ({ ...option, question_id: inserted.id })))

        if (optionsError) {
          summary.failedCount += 1
          continue
        }
      }

      await linkQuestionAssets(inserted.id, row)

      summary.importedCount += 1
      importedQuestionIds.push(inserted.id)
      existingKeys.add(key)
      if (row.externalId) {
        existingExternalIds.add(row.externalId)
      }
    } catch {
      summary.failedCount += 1
    }
  }

  for (const row of updateRows) {
    if (!row.existingQuestionId) {
      summary.failedCount += 1
      continue
    }

    try {
      const topicId = await resolveTopicId(supabase, row, topicCache, createdTopics)
      const questionTypeId = await resolveQuestionTypeId(supabase, row, topicId, typeCache, createdTypes)
      const variantId = await resolveVariantId(supabase, row, questionTypeId, variantCache, createdVariants)
      const stimulusId = await resolveStimulusId(row)
      const optionAssetIds = await resolveOptionAssetIds(row)

      const writeInput: QuestionWriteInput = {
        examType: row.examType,
        subjectId: row.subjectId,
        topicId,
        questionTypeId,
        domainCode: row.domainCode,
        subtopicCode: row.subtopicCode,
        skillCode: row.skillCode,
        patternKey: row.patternKey,
        questionFamily: row.questionFamily,
        stimulusFormat: row.stimulusFormat,
        stimulusGenre: row.stimulusGenre,
        assetRenderMethod: row.assetRenderMethod,
        writingForm: row.writingForm,
        writingPurpose: row.writingPurpose,
        writingPromptStimulus: row.writingPromptStimulus,
        yearLevel: row.yearLevel,
        difficulty: row.difficulty,
        answerFormat: row.answerFormat,
        marks: row.marks,
        timeLimitSeconds: row.timeLimitSeconds,
        questionText: row.questionText,
        passageText: row.passageText,
        stimulusId,
        options: buildOptionRecords(row, optionAssetIds),
        correctOptionLabel: row.correctOptionLabel,
        shortExplanation: row.shortExplanation,
        workedSolution: row.workedSolution || null,
        tags: row.tags,
        skillTags: row.skillTags,
        conceptTags: row.conceptTags,
        rubric: row.rubric,
        externalId: row.externalId,
        variantId,
        presentation: row.presentation,
        sourceInfo: row.sourceInfo,
        // archived is applied separately below — QuestionWriteInput only accepts editable statuses.
        status: row.status === 'archived' ? 'draft' : row.status,
      }

      await updateQuestion(row.existingQuestionId, writeInput, actorId)
      if (row.status === 'archived') {
        await archiveQuestion(row.existingQuestionId, actorId)
      }

      await linkQuestionAssets(row.existingQuestionId, row)

      summary.updatedCount += 1
      updatedQuestionIds.push(row.existingQuestionId)
    } catch {
      summary.failedCount += 1
    }
  }

  summary.createdTopicCount = createdTopics.size
  summary.createdQuestionTypeCount = createdTypes.size
  summary.createdVariantCount = createdVariants.size
  summary.createdStimulusCount = createdStimulusCount
  summary.createdAssetCount = counters.createdAssetCount
  summary.generatedAssetCount = counters.generatedAssetCount
  summary.uploadedAssetCount = counters.uploadedAssetCount
  summary.rejectedAssetCount = counters.rejectedAssetCount
  summary.assetWarnings = [...new Set(counters.assetWarnings)]

  return { summary, importedQuestionIds, updatedQuestionIds }
}
