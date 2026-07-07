import type { WritingRubric } from '@/lib/types'

/**
 * Parses raw rubric JSON into a WritingRubric. An empty string is valid (no
 * rubric); anything non-empty must be a JSON object with a `criteria` array of
 * at least one entry, each carrying a name and a positive numeric maxMarks.
 */
export function parseWritingRubric(raw: string): { rubric: WritingRubric | null; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { rubric: null, error: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { rubric: null, error: 'Rubric must be valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { rubric: null, error: 'Rubric must be a JSON object.' }
  }

  const criteria = (parsed as Record<string, unknown>).criteria
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return { rubric: null, error: 'Rubric needs a "criteria" array with at least one criterion.' }
  }

  for (const criterion of criteria) {
    if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) {
      return { rubric: null, error: 'Each rubric criterion must be an object.' }
    }
    const record = criterion as Record<string, unknown>
    if (typeof record.name !== 'string' || !record.name.trim()) {
      return { rubric: null, error: 'Each rubric criterion needs a "name".' }
    }
    if (typeof record.maxMarks !== 'number' || !Number.isFinite(record.maxMarks) || record.maxMarks <= 0) {
      return { rubric: null, error: `Criterion "${record.name}" needs a positive numeric "maxMarks".` }
    }
  }

  return { rubric: parsed as WritingRubric, error: null }
}
