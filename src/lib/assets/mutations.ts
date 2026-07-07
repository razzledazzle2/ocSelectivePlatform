import { createClient } from '@/lib/supabase/server'
import type { AssetType } from '@/lib/types'

const PENDING_REF_PREFIX = 'asset://pending/'

/** Infers the asset type from a reference's file extension (.svg → svg, images/anything else → image). */
export function inferAssetTypeFromRef(ref: string): AssetType {
  const match = ref.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)
  return match?.[1] === 'svg' ? 'svg' : 'image'
}

export interface EnsureAssetParams {
  /**
   * External reference from an import cell. Semantics:
   * - `asset://pending/...` → a placeholder asset (status 'pending', no storage path yet)
   * - `http(s)://...` → an externally hosted asset (external_url, status 'uploaded')
   * - anything else → a storage path in the question-media bucket (status 'uploaded')
   */
  ref: string
  altText?: string | null
  generationPrompt?: string | null
  licenseNotes?: string | null
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

  const isPending = ref.startsWith(PENDING_REF_PREFIX)
  const isUrl = /^https?:\/\//i.test(ref)

  const { data: inserted, error: insertError } = await supabase
    .from('assets')
    .insert({
      external_ref: ref,
      asset_type: inferAssetTypeFromRef(ref),
      storage_path: isPending || isUrl ? null : ref,
      external_url: isUrl ? ref : null,
      alt_text: params.altText?.trim() || null,
      generation_prompt: params.generationPrompt?.trim() || null,
      license_notes: params.licenseNotes?.trim() || null,
      status: isPending ? 'pending' : 'uploaded',
      created_by: params.actorId,
      updated_by: params.actorId,
    })
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
