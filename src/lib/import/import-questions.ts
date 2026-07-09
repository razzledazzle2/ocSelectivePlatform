import { resolveAssetGeneration } from '@/lib/assets/generate'
import { ensureAssetByExternalRef, linkAssetToQuestion } from '@/lib/assets/mutations'
import { normalizeQuestionText } from '@/lib/import/validation'
import type { ImportSummary, ResolvedImportQuestion } from '@/lib/import/types'
import { labelsForCount } from '@/lib/questions/option-rules'
import { slugify } from '@/lib/questions/slug'
import { ensureQuestionType, ensureQuestionVariant, ensureTopic } from '@/lib/questions/taxonomy-mutations'
import { ensureStimulusByExternalRef } from '@/lib/stimuli/mutations'
import { createClient } from '@/lib/supabase/server'
import type { QuestionSource } from '@/lib/types'

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

/**
 * Inserts fully validated import rows as questions + their options,
 * auto-creating any missing topics/question types/variants, shared stimuli and
 * (possibly pending) assets along the way — all deduped within the run.
 * Re-checks existing question text and external ids at insert time so
 * duplicates are never silently imported.
 */
export async function importValidatedQuestions(
  rows: ResolvedImportQuestion[],
  actorId: string,
  source: QuestionSource
): Promise<{ summary: ImportSummary; importedQuestionIds: string[] }> {
  const supabase = await createClient()
  const importedQuestionIds: string[] = []

  const emptySummary: ImportSummary = {
    importedCount: 0,
    skippedDuplicateCount: 0,
    createdTopicCount: 0,
    createdQuestionTypeCount: 0,
    createdVariantCount: 0,
    createdStimulusCount: 0,
    createdAssetCount: 0,
    generatedAssetCount: 0,
    failedCount: 0,
    assetWarnings: [],
  }

  if (rows.length === 0) {
    return { summary: emptySummary, importedQuestionIds }
  }

  const [{ data: existing, error: existingError }, { data: existingIds, error: existingIdsError }] =
    await Promise.all([
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
  const assetCache = new Map<string, string>()
  const createdTopics = new Set<string>()
  const createdTypes = new Set<string>()
  const createdVariants = new Set<string>()

  let importedCount = 0
  let skippedDuplicateCount = 0
  let failedCount = 0
  let createdStimulusCount = 0
  let createdAssetCount = 0
  let generatedAssetCount = 0
  const assetWarnings: string[] = []

  /**
   * Ensures the asset row for one ref, auto-generating its SVG when the ref is a
   * pending placeholder backed by a supported deterministic spec. `primary` is
   * true only for a question's single main diagram — the row-level spec is
   * paired with THAT ref only, never with option/solution refs (whose specs, if
   * any, live in the committed spec files keyed by ref).
   */
  const ensureRowAsset = async (
    row: ResolvedImportQuestion,
    ref: string,
    options: { primary?: boolean } = {}
  ): Promise<string> => {
    const generation = await resolveAssetGeneration({
      ref,
      ownSpec: options.primary ? row.assetSpec : null,
    })
    if (!generation.generated && options.primary && generation.pendingReason) {
      assetWarnings.push(`${ref}: ${generation.pendingReason}`)
    }
    const { id, created } = await ensureAssetByExternalRef({
      ref: generation.generated ? generation.ref : ref,
      altText: row.assetAltText,
      generationPrompt: row.assetGenerationPrompt,
      // Persist the exact spec rendered from (committed spec wins over row spec).
      spec: generation.spec ?? (options.primary ? row.assetSpec : null),
      status: generation.generated ? 'generated' : row.assetStatus,
      assetType: generation.generated ? generation.assetType : null,
      actorId,
      cache: assetCache,
    })
    if (created) {
      createdAssetCount += 1
      if (generation.generated) {
        generatedAssetCount += 1
      }
    }
    return id
  }

  for (const row of rows) {
    const key = normalizeQuestionText(row.questionText)
    if (existingKeys.has(key) || (row.externalId && existingExternalIds.has(row.externalId))) {
      // Duplicates only reach here when the admin chose to import them; still
      // guard against inserting the SAME text or external id twice in one run.
      skippedDuplicateCount += 1
      continue
    }

    try {
      const topicId = await resolveTopicId(supabase, row, topicCache, createdTopics)
      const questionTypeId = await resolveQuestionTypeId(supabase, row, topicId, typeCache, createdTypes)
      const variantId = await resolveVariantId(supabase, row, questionTypeId, variantCache, createdVariants)

      let stimulusId: string | null = null
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
        stimulusId = ensured.id
        if (ensured.created) {
          createdStimulusCount += 1
        }
        createdAssetCount += ensured.createdAssetCount
      }

      const optionAssetIds: Array<string | null> = []
      for (const assetRef of row.optionAssetRefs) {
        optionAssetIds.push(assetRef ? await ensureRowAsset(row, assetRef) : null)
      }

      const { data: inserted, error: insertError } = await supabase
        .from('questions')
        .insert(buildQuestionPayload(row, topicId, questionTypeId, variantId, stimulusId, actorId, source))
        .select('id')
        .single()

      if (insertError || !inserted) {
        failedCount += 1
        continue
      }

      if (row.options.length > 0) {
        const labels = labelsForCount(row.options.length)
        const { error: optionsError } = await supabase.from('question_options').insert(
          row.options.map((text, index) => ({
            question_id: inserted.id,
            label: labels[index],
            option_text: text,
            sort_order: index + 1,
            asset_id: optionAssetIds[index] ?? null,
            explanation: row.optionExplanations[index] ?? null,
          }))
        )

        if (optionsError) {
          failedCount += 1
          continue
        }
      }

      // The row-level asset_spec_json belongs to the question's single main
      // diagram; only pair it when there is exactly one question asset ref.
      const primaryQuestionAsset = row.questionAssetRefs.length === 1
      for (let index = 0; index < row.questionAssetRefs.length; index += 1) {
        const assetId = await ensureRowAsset(row, row.questionAssetRefs[index], {
          primary: primaryQuestionAsset,
        })
        await linkAssetToQuestion(inserted.id, assetId, 'question', index + 1)
      }
      for (let index = 0; index < row.solutionAssetRefs.length; index += 1) {
        const assetId = await ensureRowAsset(row, row.solutionAssetRefs[index])
        await linkAssetToQuestion(inserted.id, assetId, 'solution', index + 1)
      }

      importedCount += 1
      importedQuestionIds.push(inserted.id)
      existingKeys.add(key)
      if (row.externalId) {
        existingExternalIds.add(row.externalId)
      }
    } catch {
      failedCount += 1
    }
  }

  return {
    summary: {
      importedCount,
      skippedDuplicateCount,
      createdTopicCount: createdTopics.size,
      createdQuestionTypeCount: createdTypes.size,
      createdVariantCount: createdVariants.size,
      createdStimulusCount,
      createdAssetCount,
      generatedAssetCount,
      failedCount,
      // De-duplicated so one repeated pending spec doesn't spam the summary.
      assetWarnings: [...new Set(assetWarnings)],
    },
    importedQuestionIds,
  }
}
