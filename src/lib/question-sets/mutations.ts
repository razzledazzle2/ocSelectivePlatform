import { createClient } from '@/lib/supabase/server'
import type {
  QuestionSetType,
  SetCompletionMode,
  SetFeedbackMode,
  SetInteractionType,
  SharedOptionPoolOption,
} from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface EnsureSharedOptionPoolParams {
  externalRef: string
  title: string | null
  options: SharedOptionPoolOption[]
  actorId: string
  /** externalRef → pool id, deduping repeated refs within one import run. */
  cache?: Map<string, string>
}

/**
 * Finds a shared option pool by external_ref, creating it when missing. An
 * existing pool is reused untouched (import "reuse" semantics), so the A–G
 * sentence bank is stored once and never duplicated per child question.
 */
export async function ensureSharedOptionPoolByExternalRef(
  params: EnsureSharedOptionPoolParams
): Promise<{ id: string; created: boolean }> {
  const externalRef = params.externalRef.trim()
  if (!externalRef) {
    throw new Error('Shared option pool reference is empty.')
  }

  const cached = params.cache?.get(externalRef)
  if (cached) {
    return { id: cached, created: false }
  }

  const supabase = await createClient()
  const { data: existing, error: findError } = await supabase
    .from('shared_option_pools')
    .select('id')
    .eq('external_ref', externalRef)
    .maybeSingle()

  if (findError) {
    throw new Error('Unable to look up the shared option pool.')
  }

  if (existing?.id) {
    params.cache?.set(externalRef, existing.id)
    return { id: existing.id, created: false }
  }

  const { data, error } = await supabase
    .from('shared_option_pools')
    .insert({
      external_ref: externalRef,
      title: params.title,
      options: params.options,
      created_by: params.actorId,
      updated_by: params.actorId,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create the shared option pool.')
  }

  params.cache?.set(externalRef, data.id)
  return { id: data.id, created: true }
}

export interface EnsureQuestionSetParams {
  externalRef: string
  title: string
  setType: QuestionSetType
  instructions: string | null
  feedbackMode: SetFeedbackMode
  completionMode: SetCompletionMode
  interactionType: SetInteractionType | null
  stimulusId: string | null
  sharedOptionPoolId: string | null
  sourceInfo?: Record<string, unknown>
  actorId: string
  /** externalRef → set id, deduping repeated refs within one import run. */
  cache?: Map<string, string>
}

/**
 * Finds a question set by external_ref, creating it when missing. A re-import
 * refreshes the set's own metadata (title/type/feedback/stimulus/pool) but never
 * touches its membership except through linkQuestionToSet.
 */
export async function ensureQuestionSetByExternalRef(
  params: EnsureQuestionSetParams
): Promise<{ id: string; created: boolean }> {
  const externalRef = params.externalRef.trim()
  if (!externalRef) {
    throw new Error('Question set reference is empty.')
  }

  const cached = params.cache?.get(externalRef)
  if (cached) {
    return { id: cached, created: false }
  }

  const supabase = await createClient()
  const { data: existing, error: findError } = await supabase
    .from('question_sets')
    .select('id')
    .eq('external_ref', externalRef)
    .maybeSingle()

  if (findError) {
    throw new Error('Unable to look up the question set.')
  }

  const payload = {
    title: params.title.trim() || externalRef,
    set_type: params.setType,
    instructions: params.instructions,
    feedback_mode: params.feedbackMode,
    completion_mode: params.completionMode,
    interaction_type: params.interactionType,
    stimulus_id: params.stimulusId,
    shared_option_pool_id: params.sharedOptionPoolId,
    source_info: params.sourceInfo ?? {},
    updated_by: params.actorId,
  }

  if (existing?.id) {
    // Refresh the set's own metadata (idempotent re-import), keep membership.
    const { error: updateError } = await supabase
      .from('question_sets')
      .update(payload)
      .eq('id', existing.id)
    if (updateError) {
      throw new Error('Unable to update the question set.')
    }
    params.cache?.set(externalRef, existing.id)
    return { id: existing.id, created: false }
  }

  const { data, error } = await supabase
    .from('question_sets')
    .insert({ ...payload, external_ref: externalRef, created_by: params.actorId })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create the question set.')
  }

  params.cache?.set(externalRef, data.id)
  return { id: data.id, created: true }
}

/**
 * Links a question into a set at a position (upsert on the unique question_id):
 * re-importing the same question moves it rather than creating a duplicate.
 */
export async function linkQuestionToSet(
  supabase: SupabaseServerClient,
  input: { setId: string; questionId: string; position: number; targetLabel: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('question_set_items')
    .upsert(
      {
        set_id: input.setId,
        question_id: input.questionId,
        position: input.position,
        target_label: input.targetLabel,
      },
      { onConflict: 'question_id' }
    )

  if (error) {
    throw new Error('Unable to link the question to its set.')
  }
}
