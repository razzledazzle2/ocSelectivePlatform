// DB-facing asset generation: turn `pending` asset rows into `generated` ones,
// and repair `generated` rows whose stored ref/url drifted from the canonical
// value (e.g. an earlier malformed path). Always updates the row IN PLACE
// (same id, so every question/option link stays intact) — this is the
// "already-imported questions" sync path: no re-import, no question deletion,
// no duplication.
//
// Server-only (filesystem + Supabase). Reuses resolveAssetGeneration so the
// output matches the import-time and offline (`generate:assets`) pipelines.

import { deriveGeneratedTarget, resolveAssetGeneration } from '@/lib/assets/generate'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface CandidateAssetRow {
  id: string
  external_ref: string | null
  external_url: string | null
  spec: Record<string, unknown> | null
  status: string
}

/** Per-asset outcome for reporting back to the admin. */
export interface AssetGenerationDetail {
  assetId: string
  ref: string
  outcome: 'generated' | 'pending' | 'failed'
  reason?: string
}

export interface AssetGenerationResult {
  /** Assets generated or repaired to a working generated SVG this run. */
  generatedCount: number
  /** Assets left pending (unsupported spec / no spec / no file). */
  pendingCount: number
  /** Assets that errored while updating the DB. */
  failedCount: number
  details: AssetGenerationDetail[]
}

const EMPTY_RESULT: AssetGenerationResult = {
  generatedCount: 0,
  pendingCount: 0,
  failedCount: 0,
  details: [],
}

/**
 * A generated asset is "canonical" when its stored ref/url already match what
 * the pipeline would produce — no work needed. Pure string check (no fs), used
 * to skip healthy rows before doing any filesystem access.
 */
function isCanonicalGenerated(asset: CandidateAssetRow): boolean {
  if (asset.status !== 'generated') return false
  const target = deriveGeneratedTarget(asset.external_ref ?? '')
  if (!target) return false
  return asset.external_ref === target.generatedRef && asset.external_url === target.publicUrl
}

/** True when this row is worth (re)processing: pending, or a non-canonical generated row. */
function needsProcessing(asset: CandidateAssetRow): boolean {
  if (asset.status === 'pending') return true
  if (asset.status === 'generated') return !isCanonicalGenerated(asset)
  return false
}

/**
 * Generates/repairs one stored asset. Renders (or reuses) its SVG and, on
 * success, updates the row in place to a working generated public asset. Never
 * marks a row generated unless a real SVG file exists. Returns null when the row
 * was already correct and needed no change.
 */
async function processAsset(
  supabase: SupabaseServerClient,
  asset: CandidateAssetRow,
  actorId: string,
  options: { force?: boolean } = {}
): Promise<AssetGenerationDetail | null> {
  const ref = asset.external_ref ?? ''
  const resolution = await resolveAssetGeneration({ ref, ownSpec: asset.spec, force: options.force })

  if (!resolution.generated) {
    return { assetId: asset.id, ref, outcome: 'pending', reason: resolution.pendingReason }
  }

  const unchanged =
    asset.status === 'generated' &&
    asset.external_ref === resolution.ref &&
    asset.external_url === resolution.publicUrl
  if (unchanged && !options.force) {
    return null
  }

  // Guard the unique external_ref: if a DIFFERENT row already owns the target
  // ref, don't collide — report it instead of throwing.
  if (resolution.ref !== asset.external_ref) {
    const { data: clash } = await supabase
      .from('assets')
      .select('id')
      .eq('external_ref', resolution.ref)
      .neq('id', asset.id)
      .maybeSingle()
    if (clash?.id) {
      return {
        assetId: asset.id,
        ref,
        outcome: 'failed',
        reason: `Another asset already uses ${resolution.ref}.`,
      }
    }
  }

  const { error } = await supabase
    .from('assets')
    .update({
      external_ref: resolution.ref,
      external_url: resolution.publicUrl,
      storage_path: null,
      asset_type: resolution.assetType ?? 'svg',
      status: 'generated',
      // Persist the spec we rendered from so a later regenerate is possible.
      ...(resolution.spec ? { spec: resolution.spec } : {}),
      updated_by: actorId,
    })
    .eq('id', asset.id)

  if (error) {
    return { assetId: asset.id, ref, outcome: 'failed', reason: 'Database update failed.' }
  }

  return { assetId: asset.id, ref: resolution.ref, outcome: 'generated' }
}

function summarise(details: Array<AssetGenerationDetail | null>): AssetGenerationResult {
  const kept = details.filter((d): d is AssetGenerationDetail => d !== null)
  return {
    generatedCount: kept.filter((d) => d.outcome === 'generated').length,
    pendingCount: kept.filter((d) => d.outcome === 'pending').length,
    failedCount: kept.filter((d) => d.outcome === 'failed').length,
    details: kept,
  }
}

/** Loads pending + generated asset rows (optionally restricted to a set of ids). */
async function loadCandidateAssets(
  supabase: SupabaseServerClient,
  assetIds?: string[]
): Promise<CandidateAssetRow[]> {
  let query = supabase
    .from('assets')
    .select('id, external_ref, external_url, spec, status')
    .in('status', ['pending', 'generated'])
  if (assetIds) {
    if (assetIds.length === 0) return []
    query = query.in('id', assetIds)
  }
  const { data, error } = await query
  if (error) {
    throw new Error('Unable to load assets.')
  }
  return ((data ?? []) as CandidateAssetRow[]).filter(needsProcessing)
}

async function runOverAssets(
  supabase: SupabaseServerClient,
  assets: CandidateAssetRow[],
  actorId: string
): Promise<AssetGenerationResult> {
  if (assets.length === 0) {
    return EMPTY_RESULT
  }
  const details: Array<AssetGenerationDetail | null> = []
  for (const asset of assets) {
    try {
      details.push(await processAsset(supabase, asset, actorId))
    } catch {
      details.push({ assetId: asset.id, ref: asset.external_ref ?? '', outcome: 'failed', reason: 'Unexpected error.' })
    }
  }
  return summarise(details)
}

/** Generates/repairs every pending or drifted asset in the bank. */
export async function generateMissingAssets(actorId: string): Promise<AssetGenerationResult> {
  const supabase = await createClient()
  const assets = await loadCandidateAssets(supabase)
  return runOverAssets(supabase, assets, actorId)
}

/** Asset ids linked to a question (question/solution roles + visual options). */
async function assetIdsForQuestion(
  supabase: SupabaseServerClient,
  questionId: string
): Promise<string[]> {
  const [{ data: linked }, { data: options }] = await Promise.all([
    supabase.from('question_assets').select('asset_id').eq('question_id', questionId),
    supabase
      .from('question_options')
      .select('asset_id')
      .eq('question_id', questionId)
      .not('asset_id', 'is', null),
  ])
  const ids = new Set<string>()
  for (const row of (linked ?? []) as Array<{ asset_id: string | null }>) {
    if (row.asset_id) ids.add(row.asset_id)
  }
  for (const row of (options ?? []) as Array<{ asset_id: string | null }>) {
    if (row.asset_id) ids.add(row.asset_id)
  }
  return [...ids]
}

/** Generates/repairs the assets for a single question. */
export async function generateAssetsForQuestion(
  questionId: string,
  actorId: string
): Promise<AssetGenerationResult> {
  const supabase = await createClient()
  const assetIds = await assetIdsForQuestion(supabase, questionId)
  const assets = await loadCandidateAssets(supabase, assetIds)
  return runOverAssets(supabase, assets, actorId)
}

/**
 * Force-regenerates a single asset from its spec (for generated-but-not-approved
 * review edits). Refuses approved/uploaded assets so a human-cleared asset is
 * never silently overwritten.
 */
export async function regenerateAsset(assetId: string, actorId: string): Promise<AssetGenerationDetail> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assets')
    .select('id, external_ref, external_url, spec, status')
    .eq('id', assetId)
    .maybeSingle()
  if (error || !data) {
    return { assetId, ref: '', outcome: 'failed', reason: 'Asset not found.' }
  }
  const asset = data as CandidateAssetRow
  if (asset.status === 'approved' || asset.status === 'uploaded') {
    return {
      assetId,
      ref: asset.external_ref ?? '',
      outcome: 'failed',
      reason: `Cannot regenerate an ${asset.status} asset. Reject it first if it needs to change.`,
    }
  }
  const detail = await processAsset(supabase, asset, actorId, { force: true })
  return (
    detail ?? {
      assetId,
      ref: asset.external_ref ?? '',
      outcome: 'failed',
      reason: 'Nothing to regenerate (no supported spec or SVG).',
    }
  )
}
