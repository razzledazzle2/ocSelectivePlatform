import { createClient } from '@/lib/supabase/server'
import {
  readStimulusAttribution,
  type AssetStatus,
  type AssetType,
  type QuestionOptionRecord,
  type StimulusType,
  type StudentAssetRef,
  type StudentStimulus,
} from '@/lib/types'

/**
 * Shared hydration for STUDENT-facing question payloads (practice, revision,
 * mock exams): answer options with visual assets, linked stimuli with their
 * assets, and question-level assets. Never selects correct answers.
 */

export function getRelationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

/** Columns hydrated into StudentAssetRef (no prompts/licensing/metadata). */
export const STUDENT_ASSET_COLUMNS = 'id, asset_type, external_ref, storage_path, external_url, alt_text, status'

interface RawStudentAssetRow {
  id: string
  asset_type: AssetType
  external_ref: string | null
  storage_path: string | null
  external_url: string | null
  alt_text: string | null
  status: AssetStatus
}

export function mapStudentAsset(row: RawStudentAssetRow): StudentAssetRef {
  return {
    id: row.id,
    assetType: row.asset_type,
    externalRef: row.external_ref,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    altText: row.alt_text,
    status: row.status,
  }
}

function isRenderableAsset(row: RawStudentAssetRow | null): row is RawStudentAssetRow {
  return row !== null && row.status !== 'archived' && row.status !== 'rejected'
}

/**
 * Answer options for a set of questions, including visual option assets.
 * Deliberately excludes per-option explanations (post-answer content).
 */
export async function getStudentOptionsMap(
  questionIds: string[]
): Promise<Map<string, QuestionOptionRecord[]>> {
  const optionsMap = new Map<string, QuestionOptionRecord[]>()

  if (!questionIds.length) {
    return optionsMap
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_options')
    .select(`id, question_id, label, option_text, sort_order, asset_id, created_at, asset:assets(${STUDENT_ASSET_COLUMNS})`)
    .in('question_id', questionIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load question options.')
  }

  const rows = (data ?? []) as unknown as Array<
    Omit<QuestionOptionRecord, 'asset'> & {
      question_id: string
      asset: RawStudentAssetRow | RawStudentAssetRow[] | null
    }
  >

  for (const row of rows) {
    const asset = getRelationValue(row.asset)
    const existing = optionsMap.get(row.question_id) ?? []
    existing.push({
      id: row.id,
      question_id: row.question_id,
      label: row.label,
      option_text: row.option_text,
      sort_order: row.sort_order,
      asset_id: row.asset_id,
      asset: isRenderableAsset(asset) ? mapStudentAsset(asset) : null,
      created_at: row.created_at,
    })
    optionsMap.set(row.question_id, existing)
  }

  return optionsMap
}

/** Stimuli (with their ordered assets) for a set of stimulus ids. */
export async function getStudentStimuliMap(
  stimulusIds: string[]
): Promise<Map<string, StudentStimulus>> {
  const stimuliMap = new Map<string, StudentStimulus>()
  const uniqueIds = [...new Set(stimulusIds.filter(Boolean))]

  if (!uniqueIds.length) {
    return stimuliMap
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stimuli')
    .select(`id, title, stimulus_type, body_markdown, source_info, stimulus_assets(sort_order, asset:assets(${STUDENT_ASSET_COLUMNS}))`)
    .in('id', uniqueIds)

  if (error) {
    throw new Error('Unable to load the shared passages for these questions.')
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    title: string
    stimulus_type: StimulusType
    body_markdown: string | null
    source_info: Record<string, unknown> | null
    stimulus_assets:
      | Array<{ sort_order: number; asset: RawStudentAssetRow | RawStudentAssetRow[] | null }>
      | null
  }>

  for (const row of rows) {
    const assets = (row.stimulus_assets ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => getRelationValue(link.asset))
      .filter(isRenderableAsset)
      .map(mapStudentAsset)

    stimuliMap.set(row.id, {
      id: row.id,
      title: row.title,
      stimulusType: row.stimulus_type,
      bodyMarkdown: row.body_markdown,
      assets,
      attribution: readStimulusAttribution(row.source_info),
    })
  }

  return stimuliMap
}

/** Question-level assets (default role 'question' — pre-answer content only). */
export async function getStudentQuestionAssetsMap(
  questionIds: string[],
  role: 'question' | 'solution' = 'question'
): Promise<Map<string, StudentAssetRef[]>> {
  const assetsMap = new Map<string, StudentAssetRef[]>()

  if (!questionIds.length) {
    return assetsMap
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_assets')
    .select(`question_id, role, sort_order, asset:assets(${STUDENT_ASSET_COLUMNS})`)
    .in('question_id', questionIds)
    .eq('role', role)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load the images for these questions.')
  }

  const rows = (data ?? []) as unknown as Array<{
    question_id: string
    asset: RawStudentAssetRow | RawStudentAssetRow[] | null
  }>

  for (const row of rows) {
    const asset = getRelationValue(row.asset)
    if (!isRenderableAsset(asset)) {
      continue
    }
    const existing = assetsMap.get(row.question_id) ?? []
    existing.push(mapStudentAsset(asset))
    assetsMap.set(row.question_id, existing)
  }

  return assetsMap
}

/**
 * Reorders a question set so items sharing a stimulus sit next to each other
 * (group order = first occurrence; questions without a stimulus go last).
 * Stable, so the within-group / shuffled order is preserved.
 */
export function sortByStimulusAdjacency<T>(
  items: T[],
  stimulusIdOf: (item: T) => string | null
): T[] {
  const groupOrder = new Map<string, number>()
  for (const item of items) {
    const stimulusId = stimulusIdOf(item)
    if (stimulusId && !groupOrder.has(stimulusId)) {
      groupOrder.set(stimulusId, groupOrder.size)
    }
  }

  return [...items].sort((a, b) => {
    const rankA = groupOrder.get(stimulusIdOf(a) ?? '') ?? Number.MAX_SAFE_INTEGER
    const rankB = groupOrder.get(stimulusIdOf(b) ?? '') ?? Number.MAX_SAFE_INTEGER
    return rankA - rankB
  })
}
