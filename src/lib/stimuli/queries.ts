import { createClient } from '@/lib/supabase/server'
import type {
  AssetRecord,
  StimulusDetail,
  StimulusRecord,
  StimulusStatus,
  StimulusType,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export interface StimulusPickerItem {
  id: string
  title: string
  stimulusType: StimulusType
  status: StimulusStatus
}

/** Lightweight stimulus list for the question-form picker (active first, alphabetical). */
export async function getStimuliForPicker(): Promise<StimulusPickerItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stimuli')
    .select('id, title, stimulus_type, status')
    .order('status', { ascending: true })
    .order('title', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error('Unable to load stimuli.')
  }

  return ((data ?? []) as Array<{ id: string; title: string; stimulus_type: StimulusType; status: StimulusStatus }>).map(
    (row) => ({
      id: row.id,
      title: row.title,
      stimulusType: row.stimulus_type,
      status: row.status,
    })
  )
}

const STIMULUS_DETAIL_SELECT = `
  *,
  stimulus_assets(id, sort_order, asset:assets(*))
`

type StimulusDetailRaw = StimulusRecord & {
  stimulus_assets: Array<{ id: string; sort_order: number; asset: AssetRecord | AssetRecord[] | null }> | null
}

export function mapStimulusDetail(row: StimulusDetailRaw): StimulusDetail {
  const { stimulus_assets: links, ...stimulus } = row
  const assets = (links ?? [])
    .map((link) => ({
      id: link.id,
      sort_order: link.sort_order,
      asset: getRelationValue(link.asset),
    }))
    .filter((link): link is StimulusDetail['assets'][number] => Boolean(link.asset))
    .sort((left, right) => left.sort_order - right.sort_order)

  return { ...stimulus, assets }
}

async function getStimulusBy(column: 'id' | 'external_ref', value: string): Promise<StimulusDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stimuli')
    .select(STIMULUS_DETAIL_SELECT)
    .eq(column, value)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the stimulus.')
  }

  return data ? mapStimulusDetail(data as unknown as StimulusDetailRaw) : null
}

export async function getStimulusById(id: string): Promise<StimulusDetail | null> {
  return getStimulusBy('id', id)
}

export async function getStimulusByExternalRef(externalRef: string): Promise<StimulusDetail | null> {
  return getStimulusBy('external_ref', externalRef)
}

/** All external refs already used by stimuli — powers import validation lookups. */
export async function getExistingStimulusExternalRefs(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('stimuli').select('external_ref').not('external_ref', 'is', null)

  if (error) {
    throw new Error('Unable to load existing stimulus references.')
  }

  return ((data ?? []) as Array<{ external_ref: string | null }>)
    .map((row) => row.external_ref)
    .filter((ref): ref is string => Boolean(ref))
}
