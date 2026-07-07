import { ensureAssetByExternalRef, linkAssetToStimulus } from '@/lib/assets/mutations'
import { createClient } from '@/lib/supabase/server'
import type { StimulusStatus, StimulusType } from '@/lib/types'

export interface StimulusWriteInput {
  externalRef?: string | null
  title: string
  stimulusType: StimulusType
  bodyMarkdown: string | null
  sourceInfo?: Record<string, unknown>
  status?: StimulusStatus
}

export async function createStimulus(input: StimulusWriteInput, actorId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stimuli')
    .insert({
      external_ref: input.externalRef?.trim() || null,
      title: input.title.trim(),
      stimulus_type: input.stimulusType,
      body_markdown: input.bodyMarkdown,
      source_info: input.sourceInfo ?? {},
      status: input.status ?? 'active',
      created_by: actorId,
      updated_by: actorId,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create the stimulus.')
  }

  return data.id
}

export async function updateStimulus(id: string, input: StimulusWriteInput, actorId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('stimuli')
    .update({
      external_ref: input.externalRef?.trim() || null,
      title: input.title.trim(),
      stimulus_type: input.stimulusType,
      body_markdown: input.bodyMarkdown,
      source_info: input.sourceInfo ?? {},
      status: input.status ?? 'active',
      updated_by: actorId,
    })
    .eq('id', id)

  if (error) {
    throw new Error('Unable to update the stimulus.')
  }
}

export interface EnsureStimulusParams {
  externalRef: string
  title: string
  stimulusType: StimulusType
  bodyMarkdown: string | null
  sourceInfo?: Record<string, unknown>
  /** Asset refs linked (in order) when the stimulus is created. */
  assetRefs?: string[]
  assetAltText?: string | null
  assetGenerationPrompt?: string | null
  actorId: string
  /** externalRef → stimulus id, deduping repeated refs within one import run. */
  cache?: Map<string, string>
  /** asset ref → asset id, shared with ensureAssetByExternalRef. */
  assetCache?: Map<string, string>
}

/**
 * Finds a stimulus by external_ref, creating it (with its linked assets) when
 * missing. An existing stimulus is reused untouched — the incoming definition
 * and asset refs are ignored, matching the import "reuse" semantics.
 */
export async function ensureStimulusByExternalRef(
  params: EnsureStimulusParams
): Promise<{ id: string; created: boolean; createdAssetCount: number }> {
  const externalRef = params.externalRef.trim()
  if (!externalRef) {
    throw new Error('Stimulus reference is empty.')
  }

  const cached = params.cache?.get(externalRef)
  if (cached) {
    return { id: cached, created: false, createdAssetCount: 0 }
  }

  const supabase = await createClient()
  const { data: existing, error: findError } = await supabase
    .from('stimuli')
    .select('id')
    .eq('external_ref', externalRef)
    .maybeSingle()

  if (findError) {
    throw new Error('Unable to look up the stimulus reference.')
  }

  if (existing?.id) {
    params.cache?.set(externalRef, existing.id)
    return { id: existing.id, created: false, createdAssetCount: 0 }
  }

  const stimulusId = await createStimulus(
    {
      externalRef,
      title: params.title.trim() || externalRef,
      stimulusType: params.stimulusType,
      bodyMarkdown: params.bodyMarkdown,
      sourceInfo: params.sourceInfo,
    },
    params.actorId
  )
  params.cache?.set(externalRef, stimulusId)

  let createdAssetCount = 0
  const assetRefs = params.assetRefs ?? []
  for (let index = 0; index < assetRefs.length; index += 1) {
    const { id: assetId, created } = await ensureAssetByExternalRef({
      ref: assetRefs[index],
      altText: params.assetAltText,
      generationPrompt: params.assetGenerationPrompt,
      actorId: params.actorId,
      cache: params.assetCache,
    })
    if (created) {
      createdAssetCount += 1
    }
    await linkAssetToStimulus(stimulusId, assetId, index + 1)
  }

  return { id: stimulusId, created: true, createdAssetCount }
}
