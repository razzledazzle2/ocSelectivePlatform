import { resolveAssetRef } from '@/lib/assets/refs'
import { createClient } from '@/lib/supabase/server'
import type { AssetStatus, AssetType } from '@/lib/types'

/** Infers the asset type from a reference's file extension (.svg → svg, images/anything else → image). */
export function inferAssetTypeFromRef(ref: string): AssetType {
  const match = ref.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)
  return match?.[1] === 'svg' ? 'svg' : 'image'
}

export interface EnsureAssetParams {
  /**
   * External reference from an import cell. Interpreted by resolveAssetRef:
   * - `asset://pending/...`         → placeholder (status 'pending', no file yet)
   * - `asset://question-assets/...` → generated public asset (external_url set, status 'generated')
   * - `http(s)://...`               → externally hosted asset (external_url, status 'uploaded')
   * - anything else                 → storage path in the question-media bucket (status 'uploaded')
   */
  ref: string
  altText?: string | null
  generationPrompt?: string | null
  licenseNotes?: string | null
  /** Structured spec (from asset_spec_json) the SVG can be regenerated from. */
  spec?: Record<string, unknown> | null
  /** Explicit status from asset_status; overrides the ref-inferred default when set. */
  assetType?: AssetType | null
  status?: AssetStatus | null
  actorId: string
  /** ref → asset id, deduping repeated refs within one import run. */
  cache?: Map<string, string>
}

/** Finds an assets row by external_ref, creating it when missing. Returns whether it was created. */
export async function ensureAssetByExternalRef(
  params: EnsureAssetParams
): Promise<{ id: string; created: boolean }> {
  const ref = params.ref.trim()
  if (!ref) {
    throw new Error('Asset reference is empty.')
  }

  const cached = params.cache?.get(ref)
  if (cached) {
    return { id: cached, created: false }
  }

  const supabase = await createClient()
  const { data: existing, error: findError } = await supabase
    .from('assets')
    .select('id')
    .eq('external_ref', ref)
    .maybeSingle()

  if (findError) {
    throw new Error('Unable to look up the asset reference.')
  }

  if (existing?.id) {
    params.cache?.set(ref, existing.id)
    return { id: existing.id, created: false }
  }

  const resolved = resolveAssetRef(ref)
  // Storage layout + default status inferred from the ref scheme.
  const storagePath = resolved.kind === 'storage' ? resolved.storagePath : null
  const externalUrl = resolved.kind === 'public' || resolved.kind === 'external' ? resolved.url : null
  const defaultStatus: AssetStatus =
    resolved.kind === 'pending' ? 'pending' : resolved.kind === 'public' ? 'generated' : 'uploaded'

  const payload: Record<string, unknown> = {
    external_ref: ref,
    asset_type: params.assetType ?? inferAssetTypeFromRef(ref),
    storage_path: storagePath,
    external_url: externalUrl,
    alt_text: params.altText?.trim() || null,
    generation_prompt: params.generationPrompt?.trim() || null,
    license_notes: params.licenseNotes?.trim() || null,
    status: params.status ?? defaultStatus,
    created_by: params.actorId,
    updated_by: params.actorId,
  }
  // `spec` is only sent when present so imports still work before the
  // assets.spec migration is pushed (see supabase/migrations).
  if (params.spec) {
    payload.spec = params.spec
  }

  const { data: inserted, error: insertError } = await supabase
    .from('assets')
    .insert(payload)
    .select('id')
    .single()

  if (insertError || !inserted) {
    // A concurrent insert may have won the unique-ref race — re-read before giving up.
    const { data: raced } = await supabase.from('assets').select('id').eq('external_ref', ref).maybeSingle()
    if (raced?.id) {
      params.cache?.set(ref, raced.id)
      return { id: raced.id, created: false }
    }
    throw new Error(`Unable to create the asset for "${ref}".`)
  }

  params.cache?.set(ref, inserted.id)
  return { id: inserted.id, created: true }
}

/** Idempotently links an asset to a question in a given role (upsert on the unique key). */
export async function linkAssetToQuestion(
  questionId: string,
  assetId: string,
  role: 'question' | 'solution',
  sortOrder = 0
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('question_assets')
    .upsert(
      { question_id: questionId, asset_id: assetId, role, sort_order: sortOrder },
      { onConflict: 'question_id,asset_id,role' }
    )

  if (error) {
    throw new Error('Unable to link the asset to the question.')
  }
}

/** Idempotently links an asset to a stimulus (upsert on the unique key). */
export async function linkAssetToStimulus(stimulusId: string, assetId: string, sortOrder = 0): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('stimulus_assets')
    .upsert(
      { stimulus_id: stimulusId, asset_id: assetId, sort_order: sortOrder },
      { onConflict: 'stimulus_id,asset_id' }
    )

  if (error) {
    throw new Error('Unable to link the asset to the stimulus.')
  }
}
