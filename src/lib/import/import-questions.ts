import { resolveSolution } from '@/lib/content/solution'
import { findUploadedAssetFile } from '@/lib/import/asset-package'
import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion, UploadedAssetFile } from '@/lib/import/types'
import { resolveAssetGeneration } from '@/lib/assets/generate'
import { readImageDimensions, sha256Hex } from '@/lib/assets/image-metadata'
import { deleteAssetsByIds, ensureAssetByExternalRef, linkAssetToQuestion } from '@/lib/assets/mutations'
import { buildAssetStoragePath, removeUploadedAssets, uploadQuestionAsset, validateAssetFile } from '@/lib/assets/upload'
import { archiveQuestion, updateQuestion } from '@/lib/questions/mutations'
import { labelsForCount } from '@/lib/questions/option-rules'
import { slugify } from '@/lib/questions/slug'
import { ensureQuestionType, ensureQuestionVariant, ensureTopic } from '@/lib/questions/taxonomy-mutations'
import { ensureStimulusByExternalRef } from '@/lib/stimuli/mutations'
import { createClient } from '@/lib/supabase/server'
import { getSubtopic } from '@/lib/taxonomy'
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
    // short_explanation is deprecated and no longer written; a legacy CSV's
    // short_explanation is folded into the authoritative worked solution.
    worked_solution: resolveSolution(row.workedSolution, row.shortExplanation),
    correct_option_label: row.correctOptionLabel,
    rubric: row.rubric,
    presentation: row.presentation,
    source_info: row.sourceInfo,
    status: row.status,
    source,
    tags: row.tags,
    skill_tags: row.skillTags,
    concept_tags: row.conceptTags,
    // Canonical placement invariant: a stored subtopic's parent domain always
    // wins, and a subtopic present without a domain still gets one. This keeps
    // domain_code consistent with subtopic_code for every insert path (CSV,
    // package, promote), so the admin domain filter and the subtopic-derived
    // student views never disagree.
    domain_code: getSubtopic(row.subtopicCode)?.domainCode ?? row.domainCode,
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
  duplicateChecksumCount: number
  reusedExistingAssetCount: number
  assetLinksCreated: number
  assetWarnings: string[]
}

/** A storage/dedup decision recorded for one asset reference (server-side structured log only). */
type AssetDecision = 'uploaded' | 'reused-current-import' | 'reused-existing-object' | 'generated' | 'pending' | 'rejected'

/**
 * Compact, non-sensitive structured log per asset reference. Deliberately omits signed URLs,
 * buffers and credentials — only the external id, role, checksum prefix and the storage/link
 * decision. Kept single-line so an import run is easy to grep: `[question-import:asset]`.
 */
function logAssetDecision(fields: {
  externalId: string | null
  role: string
  ref: string
  decision: AssetDecision
  checksum?: string
  storagePath?: string
  linked?: boolean
}): void {
  console.info(
    `[question-import:asset] externalId=${fields.externalId ?? '-'} role=${fields.role} decision=${fields.decision}` +
      `${fields.checksum ? ` checksum=${fields.checksum.slice(0, 12)}` : ''}` +
      `${fields.storagePath ? ` storagePath=${fields.storagePath}` : ''}` +
      `${fields.linked === undefined ? '' : ` linked=${fields.linked}`} ref=${fields.ref}`
  )
}

/** Where an asset ref sits on a row — namespaces its deterministic storage path. */
export interface AssetRoleContext {
  /** stimulus | question | solution | option-a … */
  role: string
  /** 0-based index within a multi-asset role. */
  index: number
  /** True for the row's single main diagram (pairs the row-level asset_spec_json). */
  primary?: boolean
}

/**
 * Builds the shared "ensure an asset row for this ref" helper used by every role (stimulus,
 * question, option, solution) on both create and update rows. When the ref matches a file from an
 * uploaded package it is:
 *   1. validated (extension/MIME-sniff/size/SVG-sanitised) — invalid files become a `rejected`
 *      asset and never block the question import;
 *   2. checksummed (SHA-256) — a byte-identical file already handled this run is reused (dedup,
 *      recorded as a duplicate-checksum warning) instead of re-uploaded;
 *   3. uploaded to a deterministic, content-addressed path in the private question-media bucket,
 *      with its dimensions/size/checksum recorded in assets.metadata.
 * Otherwise it falls back to the existing generation / pending / external / bare-key handling.
 *
 * Every storage object and brand-new asset row is tracked so `cleanup()` can compensate (delete
 * both) when the run ends up writing no questions at all.
 */
function createAssetEnsurer(actorId: string, assetFiles: Map<string, UploadedAssetFile>) {
  const assetCache = new Map<string, string>()
  // checksum → { path, assetId, ref } for identical-content dedup within one run.
  const checksumCache = new Map<string, { path: string; assetId: string; ref: string }>()
  const stagedPaths: string[] = []
  const stagedAssetIds = new Set<string>()
  const counters: AssetCounters = {
    createdAssetCount: 0,
    generatedAssetCount: 0,
    uploadedAssetCount: 0,
    rejectedAssetCount: 0,
    duplicateChecksumCount: 0,
    reusedExistingAssetCount: 0,
    assetLinksCreated: 0,
    assetWarnings: [],
  }

  const trackCreated = (id: string, created: boolean) => {
    if (created) {
      counters.createdAssetCount += 1
      stagedAssetIds.add(id)
    }
  }

  const ensureRowAsset = async (row: ResolvedImportQuestion, ref: string, context: AssetRoleContext): Promise<string> => {
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
        trackCreated(id, created)
        logAssetDecision({ externalId: row.externalId, role: context.role, ref, decision: 'rejected' })
        return id
      }

      const buffer = validation.sanitizedBuffer ?? uploaded.buffer
      const checksum = sha256Hex(buffer)

      // Identical bytes already uploaded this run — reuse the same asset (dedup + idempotent).
      const duplicate = checksumCache.get(checksum)
      if (duplicate) {
        counters.duplicateChecksumCount += 1
        counters.assetWarnings.push(`${ref}: identical image to ${duplicate.ref}; reusing the uploaded file.`)
        logAssetDecision({ externalId: row.externalId, role: context.role, ref, decision: 'reused-current-import', checksum })
        return duplicate.assetId
      }

      const storagePath = buildAssetStoragePath({
        externalId: row.externalId ?? 'question',
        role: context.role,
        index: context.index,
        mimeType: validation.mimeType,
        checksum,
      })
      await uploadQuestionAsset(storagePath, buffer, validation.mimeType)
      stagedPaths.push(storagePath)
      counters.uploadedAssetCount += 1

      const dimensions = readImageDimensions(buffer)
      const metadata: Record<string, unknown> = {
        checksum,
        size_bytes: buffer.length,
        mime_type: validation.mimeType,
        original_filename: uploaded.filename,
        source: 'upload',
        ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
      }

      const { id, created } = await ensureAssetByExternalRef({
        ref: storagePath,
        altText: row.assetAltText,
        generationPrompt: row.assetGenerationPrompt,
        status: 'uploaded',
        assetType: validation.assetType,
        metadata,
        actorId,
        cache: assetCache,
      })
      trackCreated(id, created)
      if (!created) {
        // Storage object was uploaded (upsert) but the assets row already existed on a prior run.
        counters.reusedExistingAssetCount += 1
      }
      checksumCache.set(checksum, { path: storagePath, assetId: id, ref })
      logAssetDecision({
        externalId: row.externalId,
        role: context.role,
        ref,
        decision: created ? 'uploaded' : 'reused-existing-object',
        checksum,
        storagePath,
      })
      return id
    }

    const generation = await resolveAssetGeneration({
      ref,
      ownSpec: context.primary ? row.assetSpec : null,
    })
    if (!generation.generated && context.primary && generation.pendingReason) {
      counters.assetWarnings.push(`${ref}: ${generation.pendingReason}`)
    }
    const { id, created } = await ensureAssetByExternalRef({
      ref: generation.generated ? generation.ref : ref,
      altText: row.assetAltText,
      generationPrompt: row.assetGenerationPrompt,
      spec: generation.spec ?? (context.primary ? row.assetSpec : null),
      status: generation.generated ? 'generated' : row.assetStatus,
      assetType: generation.generated ? generation.assetType : row.assetType,
      actorId,
      cache: assetCache,
    })
    if (created) {
      trackCreated(id, created)
      if (generation.generated) {
        counters.generatedAssetCount += 1
      }
    }
    return id
  }

  /**
   * Compensation: remove every staged storage object and brand-new asset row created this run.
   * Only safe to call when the run linked nothing (no question referenced these) — the caller
   * guards on that. Cleanup failures are surfaced as warnings, never swallowed.
   */
  const cleanup = async (): Promise<string[]> => {
    const warnings: string[] = []
    const { failedPaths } = await removeUploadedAssets(stagedPaths)
    if (failedPaths.length > 0) {
      warnings.push(`Cleanup incomplete: ${failedPaths.length} staged file(s) could not be removed from storage.`)
    }
    try {
      await deleteAssetsByIds([...stagedAssetIds])
    } catch {
      warnings.push('Cleanup incomplete: some asset records created during the failed import could not be removed.')
    }
    return warnings
  }

  return { ensureRowAsset, counters, assetCache, cleanup, hasStagedUploads: () => stagedPaths.length > 0 }
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
    duplicateChecksumCount: 0,
    reusedExistingAssetCount: 0,
    assetLinksCreated: 0,
    failedCount: 0,
    cleanupWarnings: [],
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
  assetFiles: Map<string, UploadedAssetFile>
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
  const { ensureRowAsset, counters, assetCache, cleanup, hasStagedUploads } = createAssetEnsurer(actorId, assetFiles)
  const createdTopics = new Set<string>()
  const createdTypes = new Set<string>()
  const createdVariants = new Set<string>()
  let createdStimulusCount = 0

  const resolveOptionAssetIds = async (row: ResolvedImportQuestion): Promise<Array<string | null>> => {
    const optionAssetIds: Array<string | null> = []
    const labels = labelsForCount(row.options.length)
    for (let index = 0; index < row.optionAssetRefs.length; index += 1) {
      const assetRef = row.optionAssetRefs[index]
      const role = `option-${(labels[index] ?? String(index + 1)).toLowerCase()}`
      optionAssetIds.push(assetRef ? await ensureRowAsset(row, assetRef, { role, index: 0 }) : null)
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
        // Route stimulus assets through the shared ensurer so ZIP-uploaded stimulus images are
        // validated, checksummed, uploaded and dedup'd exactly like question/option/solution ones.
        ensureAsset: (ref, index) => ensureRowAsset(row, ref, { role: 'stimulus', index }),
      })
      if (ensured.created) {
        createdStimulusCount += 1
        // Stimulus assets are linked exactly once, only when the stimulus is first created;
        // a reused stimulus (e.g. a second row sharing the same stimulus_id) links nothing.
        counters.assetLinksCreated += row.stimulusDefinition?.assetRefs?.length ?? 0
      }
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
      const assetId = await ensureRowAsset(row, row.questionAssetRefs[index], {
        role: 'question',
        index,
        primary: primaryQuestionAsset,
      })
      await linkAssetToQuestion(questionId, assetId, 'question', index + 1)
      counters.assetLinksCreated += 1
    }
    for (let index = 0; index < row.solutionAssetRefs.length; index += 1) {
      const assetId = await ensureRowAsset(row, row.solutionAssetRefs[index], { role: 'solution', index })
      await linkAssetToQuestion(questionId, assetId, 'solution', index + 1)
      counters.assetLinksCreated += 1
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
        // Each option that carries an asset_id is a persisted option→asset link.
        counters.assetLinksCreated += optionAssetIds.filter(Boolean).length
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
        workedSolution: resolveSolution(row.workedSolution, row.shortExplanation),
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
      counters.assetLinksCreated += optionAssetIds.filter(Boolean).length
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

  // Compensation: if the whole run wrote no question at all but did stage storage uploads, nothing
  // references those objects/asset rows — remove them so a failed package leaves no orphans behind.
  const wroteNothing = summary.importedCount === 0 && summary.updatedCount === 0
  if (wroteNothing && hasStagedUploads()) {
    summary.cleanupWarnings = await cleanup()
    counters.uploadedAssetCount = 0
    counters.createdAssetCount = 0
  }

  summary.createdTopicCount = createdTopics.size
  summary.createdQuestionTypeCount = createdTypes.size
  summary.createdVariantCount = createdVariants.size
  summary.createdStimulusCount = createdStimulusCount
  summary.createdAssetCount = counters.createdAssetCount
  summary.generatedAssetCount = counters.generatedAssetCount
  summary.uploadedAssetCount = counters.uploadedAssetCount
  summary.rejectedAssetCount = counters.rejectedAssetCount
  summary.duplicateChecksumCount = counters.duplicateChecksumCount
  summary.reusedExistingAssetCount = counters.reusedExistingAssetCount
  summary.assetLinksCreated = counters.assetLinksCreated
  summary.assetWarnings = [...new Set(counters.assetWarnings)]

  console.info(
    '[question-import:summary] ' +
      `imported=${summary.importedCount} updated=${summary.updatedCount} ` +
      `newStorageObjects=${summary.uploadedAssetCount} existingObjectsReused=${summary.reusedExistingAssetCount} ` +
      `currentImportDuplicatesReused=${summary.duplicateChecksumCount} assetRecordsCreated=${summary.createdAssetCount} ` +
      `assetLinksCreated=${summary.assetLinksCreated} rejected=${summary.rejectedAssetCount} failed=${summary.failedCount}`
  )

  return { summary, importedQuestionIds, updatedQuestionIds }
}
