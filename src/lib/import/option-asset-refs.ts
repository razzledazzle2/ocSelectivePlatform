import type { QuestionOptionLabel } from '@/lib/types'

/**
 * Option labels A–E. Inlined (rather than importing the QUESTION_OPTION_LABELS value from
 * '@/lib/types') so this module has ZERO value imports and stays runnable under the repo's
 * `node --test --experimental-strip-types` runner, which can't resolve `@/` value imports.
 * Must mirror QUESTION_OPTION_LABELS in src/lib/types.ts.
 */
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const

function isOptionLabel(value: string): value is QuestionOptionLabel {
  return (OPTION_LABELS as readonly string[]).includes(value)
}

/**
 * Normalises a single option_asset_refs_json value to a list of trimmed, non-empty ref strings.
 * Supports both the legacy string form ({"A": "a.png"}) and the array form ({"A": ["a.png"]}).
 * Any other shape (number, object, null, mixed non-strings) yields an empty list — the caller
 * distinguishes "no refs" from "malformed" via the `invalid` flag in parseOptionAssetRefs.
 */
export function normaliseOptionAssetValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : []
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export interface ParsedOptionAssetRefs {
  /** label → the single ref used for that option (first, when several were listed). Null cell → null. */
  map: Partial<Record<QuestionOptionLabel, string>> | null
  /** Labels that supplied more than one ref (only the first is stored per option). */
  multi: QuestionOptionLabel[]
  /** True when the cell is present but not a flat object keyed by A–E of string|string[] values. */
  invalid: boolean
}

/**
 * Parses an option_asset_refs_json cell into a label → single-ref map. Each label's value may be a
 * single ref string ({"A": "a.png"}) or a JSON array of refs ({"A": ["a.png", "a2.png"]}). Only one
 * asset is storable per option (question_options.asset_id), so the FIRST ref is used and any label
 * that supplied more than one is reported in `multi` for a non-blocking warning. A value that is
 * neither a string nor an array (e.g. a number or nested object) makes the whole cell `invalid` so
 * it surfaces as a row-level error rather than silently dropping the option.
 */
export function parseOptionAssetRefs(cell: string): ParsedOptionAssetRefs {
  if (!cell.trim()) {
    return { map: null, multi: [], invalid: false }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cell)
  } catch {
    return { map: null, multi: [], invalid: true }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { map: null, multi: [], invalid: true }
  }

  const map: Partial<Record<QuestionOptionLabel, string>> = {}
  const multi: QuestionOptionLabel[] = []
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const label = key.trim().toUpperCase()
    if (!isOptionLabel(label)) {
      return { map: null, multi: [], invalid: true }
    }
    // A value that is neither string nor array is malformed — do not silently ignore it.
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return { map: null, multi: [], invalid: true }
    }
    const refs = normaliseOptionAssetValue(value)
    if (refs.length > 0) {
      map[label] = refs[0]
      if (refs.length > 1) {
        multi.push(label)
      }
    }
  }
  return { map, multi, invalid: false }
}
