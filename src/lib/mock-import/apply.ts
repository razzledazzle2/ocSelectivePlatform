import { findUploadedAssetFile } from '@/lib/import/asset-package'
import { resolveAssetGeneration } from '@/lib/assets/generate'
import { readImageDimensions, sha256Hex } from '@/lib/assets/image-metadata'
import { ensureAssetByExternalRef, linkAssetToQuestion } from '@/lib/assets/mutations'
import { buildAssetStoragePath, uploadQuestionAsset, validateAssetFile } from '@/lib/assets/upload'
import { ensureTopic } from '@/lib/questions/taxonomy-mutations'
import { labelsForCount } from '@/lib/questions/option-rules'
import { SECTIONED_MOCK_SECTIONS } from '@/lib/mock-exams/config'
import { subjectSlugForCode } from '@/lib/mock-import/schema'
import type {
  MockImportSettings,
  MockImportSummary,
  MockImportValidationResult,
  ResolvedMockQuestion,
  UploadedAssetFile,
  ValidatedMockRow,
} from '@/lib/mock-import/types'
import type { MockTestSectionKey } from '@/lib/mock-tests/types'
import { getDomainLabel } from '@/lib/taxonomy'
import { createClient } from '@/lib/supabase/server'
import type { AssetType } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface ApplyMockImportInput {
  validation: MockImportValidationResult
  settings: MockImportSettings
  assetFiles: Map<string, UploadedAssetFile>
  actorId: string
  /** Optional blueprint to record on the mock header. */
  blueprintId: string | null
  examType: 'OC' | 'Selective'
}

const SECTION_CONFIG_BY_KEY = new Map<string, (typeof SECTIONED_MOCK_SECTIONS)[number]>(
  SECTIONED_MOCK_SECTIONS.map((section) => [section.key, section])
)
const SECTION_ORDER: MockTestSectionKey[] = ['reading', 'mathematical_reasoning', 'thinking_skills', 'writing', 'custom']

/** Ensure a single asset row for a question and return its id, or null when absent. */
async function ensureQuestionAsset(
  resolved: ResolvedMockQuestion,
  assetFiles: Map<string, UploadedAssetFile>,
  actorId: string,
  cache: Map<string, string>,
  counters: { uploaded: number; pending: number; rejected: number }
): Promise<string | null> {
  const ref = resolved.assetRef
  if (!ref) return null

  const uploaded = assetFiles.size > 0 ? findUploadedAssetFile(assetFiles, ref) : null
  if (uploaded) {
    const validation = validateAssetFile(uploaded)
    if (!validation.ok) {
      counters.rejected += 1
      const { id } = await ensureAssetByExternalRef({
        ref,
        altText: resolved.assetAltText,
        status: 'rejected',
        assetType: (resolved.assetType as AssetType | null) ?? null,
        actorId,
        cache,
      })
      return id
    }
    const buffer = validation.sanitizedBuffer ?? uploaded.buffer
    const checksum = sha256Hex(buffer)
    const storagePath = buildAssetStoragePath({
      externalId: resolved.externalId || 'question',
      role: 'question',
      index: 0,
      mimeType: validation.mimeType,
      checksum,
    })
    await uploadQuestionAsset(storagePath, buffer, validation.mimeType)
    counters.uploaded += 1
    const dimensions = readImageDimensions(buffer)
    const { id } = await ensureAssetByExternalRef({
      ref: storagePath,
      altText: resolved.assetAltText,
      status: 'uploaded',
      assetType: validation.assetType,
      metadata: {
        checksum,
        size_bytes: buffer.length,
        mime_type: validation.mimeType,
        original_filename: uploaded.filename,
        source: 'upload',
        ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
      },
      actorId,
      cache,
    })
    return id
  }

  // No file supplied: deterministic generation / pending / external / bare-key.
  const generation = await resolveAssetGeneration({ ref, ownSpec: null })
  if (!generation.generated) counters.pending += 1
  const { id } = await ensureAssetByExternalRef({
    ref: generation.generated ? generation.ref : ref,
    altText: resolved.assetAltText,
    status: generation.generated ? 'generated' : 'pending',
    assetType: generation.generated ? generation.assetType : (resolved.assetType as AssetType | null) ?? null,
    actorId,
    cache,
  })
  return id
}

/** Insert or update the underlying question for a new_question row; returns its id. */
async function upsertNewQuestion(
  supabase: SupabaseServerClient,
  resolved: ResolvedMockQuestion,
  subjectIdBySlug: Map<string, string>,
  settings: MockImportSettings,
  actorId: string,
  topicCache: Map<string, string>
): Promise<string | null> {
  const slug = resolved.subjectSlug ?? (resolved.subjectCode ? subjectSlugForCode(resolved.subjectCode) : null)
  const subjectId = slug ? subjectIdBySlug.get(slug) : undefined
  if (!subjectId) return null

  // Legacy topic_id is NOT NULL — derive a topic from the domain label.
  const topicName = getDomainLabel(resolved.domainCode) ?? 'General'
  const topicKey = `${subjectId}:${topicName}`
  let topicId = topicCache.get(topicKey)
  if (!topicId) {
    topicId = await ensureTopic(supabase, subjectId, topicName)
    topicCache.set(topicKey, topicId)
  }

  const now = new Date().toISOString()
  const status = settings.questionStatus
  // Mock-only unless the admin promotes it into the browsable bank.
  const origin = settings.alsoAddToBank ? 'bank' : 'mock_import'

  const payload = {
    external_id: resolved.externalId,
    subject_id: subjectId,
    topic_id: topicId,
    exam_type: resolved.examType,
    difficulty: resolved.difficulty,
    marks: resolved.marks,
    answer_format: resolved.answerFormat,
    question_text: resolved.questionText,
    worked_solution: resolved.workedSolution,
    short_explanation: resolved.shortExplanation,
    correct_option_label: resolved.correctOptionLabel,
    status,
    source: 'csv' as const,
    origin,
    tags: resolved.tags,
    domain_code: resolved.domainCode,
    subtopic_code: resolved.subtopicCode,
    skill_code: resolved.skillCode,
    pattern_key: resolved.patternKey,
    question_family: resolved.questionFamily,
    stimulus_format: resolved.stimulusFormat,
    stimulus_genre: resolved.stimulusGenre,
    asset_render_method: resolved.assetRenderMethod,
    updated_by: actorId,
    published_at: status === 'published' ? now : null,
  }

  // Match an existing question by external_id (idempotent re-import).
  const { data: existing } = await supabase
    .from('questions')
    .select('id, origin')
    .eq('external_id', resolved.externalId)
    .maybeSingle()

  let questionId: string
  if (existing?.id) {
    // Never demote a bank question back to mock_import on re-import.
    const keepOrigin = existing.origin === 'bank' ? 'bank' : origin
    const { error } = await supabase
      .from('questions')
      .update({ ...payload, origin: keepOrigin })
      .eq('id', existing.id)
    if (error) return null
    questionId = existing.id
    await supabase.from('question_options').delete().eq('question_id', questionId)
  } else {
    const { data: inserted, error } = await supabase
      .from('questions')
      .insert({ ...payload, created_by: actorId })
      .select('id')
      .single()
    if (error || !inserted) return null
    questionId = inserted.id
  }

  if (resolved.options.length > 0) {
    const labels = labelsForCount(resolved.options.length)
    const optionRows = resolved.options.map((text, index) => ({
      question_id: questionId,
      label: labels[index],
      option_text: text,
      sort_order: index + 1,
    }))
    const { error: optionsError } = await supabase.from('question_options').insert(optionRows)
    if (optionsError) return null
  }

  return questionId
}

function timeLimitFor(sectionKey: MockTestSectionKey): number {
  return SECTION_CONFIG_BY_KEY.get(sectionKey)?.timeLimitSeconds ?? 20 * 60
}
function breakAfterFor(sectionKey: MockTestSectionKey): number {
  return SECTION_CONFIG_BY_KEY.get(sectionKey)?.breakAfterSeconds ?? 0
}
function sectionName(sectionKey: MockTestSectionKey): string {
  return SECTION_CONFIG_BY_KEY.get(sectionKey)?.name ?? 'Custom'
}

/**
 * Apply a validated mock import. Creates (or updates) the mock header, resolves
 * every importable row to a question (creating mock-only questions as needed),
 * then rebuilds the mock's sections and ordered questions. Only importable rows
 * are applied; invalid rows are skipped (never silently dropped — the caller
 * shows them). Never publishes anything: the mock lands as a reviewable draft.
 */
export async function applyMockImport(input: ApplyMockImportInput): Promise<MockImportSummary> {
  const { validation, settings, assetFiles, actorId } = input
  const supabase = await createClient()

  const mockExternalId = validation.mockExternalId
  if (!mockExternalId) {
    throw new Error('The mock CSV is missing a mock_external_id.')
  }

  const importableRows = validation.rows.filter(
    (row): row is ValidatedMockRow & { resolved: ResolvedMockQuestion } => row.isImportable && row.resolved !== null
  )
  if (importableRows.length === 0) {
    throw new Error('There are no valid rows to import.')
  }

  // Resolve subject ids once.
  const { data: subjects } = await supabase.from('subjects').select('id, slug')
  const subjectIdBySlug = new Map(((subjects ?? []) as Array<{ id: string; slug: string }>).map((s) => [s.slug, s.id]))

  // Header: match existing mock by external_id or create a new draft.
  const mockName = validation.mockName || mockExternalId
  let mockTestId = validation.existingMockId
  let created = false
  let updated = false

  const headerPayload = {
    title: mockName,
    exam_type: input.examType,
    source: 'csv_import' as const,
    external_id: mockExternalId,
    blueprint_id: input.blueprintId,
    updated_by: actorId,
  }

  if (settings.mode === 'update') {
    if (!mockTestId) {
      throw new Error(`No existing mock has mock_external_id "${mockExternalId}" to update.`)
    }
    const { error } = await supabase.from('mock_tests').update(headerPayload).eq('id', mockTestId)
    if (error) throw new Error('Unable to update the mock header.')
    updated = true
    // Rebuild: drop existing sections (cascades to mock_test_questions).
    await supabase.from('mock_test_sections').delete().eq('mock_test_id', mockTestId)
  } else {
    if (mockTestId) {
      throw new Error(
        `A mock with mock_external_id "${mockExternalId}" already exists. Use Update mode to modify it.`
      )
    }
    const { data: inserted, error } = await supabase
      .from('mock_tests')
      .insert({ ...headerPayload, created_by: actorId, status: 'draft' })
      .select('id')
      .single()
    if (error || !inserted) throw new Error('Unable to create the mock.')
    mockTestId = inserted.id
    created = true
  }

  // Resolve each row to a question id.
  const assetCache = new Map<string, string>()
  const topicCache = new Map<string, string>()
  const counters = { uploaded: 0, pending: 0, rejected: 0 }
  let questionsCreated = 0
  let questionsUpdated = 0
  let questionsReferenced = 0
  let addedToBank = 0
  const warnings: string[] = []

  interface PlacedQuestion {
    questionId: string
    sectionKey: MockTestSectionKey
    orderIndex: number
    marks: number
  }
  const placed: PlacedQuestion[] = []

  for (const row of importableRows) {
    const resolved = row.resolved
    let questionId: string | null = null

    if (resolved.kind === 'existing_reference') {
      questionId = resolved.existingQuestionId
      if (questionId) questionsReferenced += 1
    } else {
      const existedBefore = await questionExistsByExternalId(supabase, resolved.externalId)
      questionId = await upsertNewQuestion(supabase, resolved, subjectIdBySlug, settings, actorId, topicCache)
      if (questionId) {
        if (existedBefore) questionsUpdated += 1
        else questionsCreated += 1
        if (settings.alsoAddToBank) addedToBank += 1
        const assetId = await ensureQuestionAsset(resolved, assetFiles, actorId, assetCache, counters)
        if (assetId) await linkAssetToQuestion(questionId, assetId, 'question', 1)
      } else {
        warnings.push(`Row ${row.rowNumber}: could not create the question (subject may be missing).`)
      }
    }

    if (questionId) {
      placed.push({
        questionId,
        sectionKey: resolved.sectionKey,
        orderIndex: resolved.orderIndex,
        marks: resolved.marks,
      })
    }
  }

  // Build sections in canonical order, each containing its questions by order_index.
  const usedSectionKeys = SECTION_ORDER.filter((key) => placed.some((item) => item.sectionKey === key))
  let sectionOrder = 0
  for (const sectionKey of usedSectionKeys) {
    sectionOrder += 1
    const slug = subjectSlugForSection(sectionKey)
    const subjectId = slug ? subjectIdBySlug.get(slug) ?? null : null
    const { data: sectionRow, error: sectionError } = await supabase
      .from('mock_test_sections')
      .insert({
        mock_test_id: mockTestId,
        section_order: sectionOrder,
        section_key: sectionKey,
        name: sectionName(sectionKey),
        subject_id: subjectId,
        time_limit_seconds: timeLimitFor(sectionKey),
        break_after_seconds: breakAfterFor(sectionKey),
      })
      .select('id')
      .single()
    if (sectionError || !sectionRow) {
      throw new Error('Unable to create the mock sections.')
    }

    const sectionQuestions = placed
      .filter((item) => item.sectionKey === sectionKey)
      .sort((a, b) => a.orderIndex - b.orderIndex)

    // A question may appear once per mock (unique constraint); de-dupe defensively.
    const seen = new Set<string>()
    let questionOrder = 0
    const questionRows: Array<Record<string, unknown>> = []
    for (const item of sectionQuestions) {
      if (seen.has(item.questionId)) continue
      seen.add(item.questionId)
      questionOrder += 1
      questionRows.push({
        mock_test_id: mockTestId,
        section_id: sectionRow.id,
        question_id: item.questionId,
        question_order: questionOrder,
        marks: item.marks,
      })
    }
    if (questionRows.length > 0) {
      const { error: questionsError } = await supabase.from('mock_test_questions').insert(questionRows)
      if (questionsError) {
        throw new Error('Unable to attach questions to the mock sections.')
      }
    }
  }

  return {
    mockTestId,
    mockName,
    created,
    updated,
    questionsCreated,
    questionsUpdated,
    questionsReferenced,
    questionsRemoved: 0,
    assetsUploaded: counters.uploaded,
    assetsPending: counters.pending,
    assetsRejected: counters.rejected,
    addedToBank,
    warnings,
  }
}

async function questionExistsByExternalId(supabase: SupabaseServerClient, externalId: string): Promise<boolean> {
  const { data } = await supabase.from('questions').select('id').eq('external_id', externalId).maybeSingle()
  return Boolean(data?.id)
}

/** subjects.slug for a section, or null for the writing/custom sections. */
function subjectSlugForSection(sectionKey: MockTestSectionKey): string | null {
  switch (sectionKey) {
    case 'reading':
      return 'reading'
    case 'mathematical_reasoning':
      return 'mathematical-reasoning'
    case 'thinking_skills':
      return 'thinking-skills'
    case 'writing':
      return 'writing'
    default:
      return null
  }
}
