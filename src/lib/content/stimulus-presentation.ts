import type { StimulusType } from '@/lib/types'

/**
 * How a stimulus is presented to a student.
 *
 * - `reading`  — genuine Reading passages: long-form typography, a passage
 *   title, a clear reading container. Only Reading uses this.
 * - `supporting` — Thinking Skills / Maths supporting information: plain,
 *   compact, integrated with the prompt, no content-type label, no colour tint.
 *
 * The internal `stimulus_type` value is NEVER surfaced to students as a label;
 * it only informs rendering logic (and stays visible in the admin surfaces).
 */
export type StimulusVariant = 'reading' | 'supporting'

/** Structured-data stimuli where an author-provided title acts as a real label. */
const DATA_STIMULUS_TYPES: ReadonlySet<StimulusType> = new Set<StimulusType>([
  'table',
  'chart',
  'logic_grid',
  'rule_box',
  'image_set',
])

/**
 * Reading passages get the passage treatment; every other subject's textual
 * stimulus (Thinking Skills, Maths, Writing context) gets compact supporting
 * presentation. Subject is the discriminator, not the stimulus type — Thinking
 * Skills arguments are often stored as `passage`/`information_text` too.
 */
export function resolveStimulusVariant(subjectName: string | null | undefined): StimulusVariant {
  return (subjectName ?? '').toLowerCase().includes('reading') ? 'reading' : 'supporting'
}

/**
 * Whether to show the stimulus title to a student. Reading always titles its
 * passage. Supporting content only titles genuine data blocks (a table/chart/
 * logic grid/rule box/image set) — for prose arguments a title would just echo
 * the scenario, so it is suppressed.
 */
export function shouldShowStimulusTitle(
  variant: StimulusVariant,
  stimulusType: StimulusType,
  title: string | null | undefined
): boolean {
  if (!title || !title.trim()) return false
  if (variant === 'reading') return true
  return DATA_STIMULUS_TYPES.has(stimulusType)
}

/**
 * Very short supporting content (a sentence or two, no shown title, no assets)
 * should render inline as part of the question rather than in its own box.
 */
export function isInlineSupportingBody(body: string | null | undefined): boolean {
  const trimmed = (body ?? '').trim()
  if (!trimmed) return false
  const singleBlock = !/\n{2,}/.test(trimmed)
  return singleBlock && trimmed.length <= 180
}
