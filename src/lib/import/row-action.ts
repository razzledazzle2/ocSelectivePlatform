import type { ImportMode } from '@/lib/import/types'

/**
 * Pure decision of what an import row does, given its mode and whether its external_id already
 * matches an existing question. No `@/` runtime imports — unit-testable directly with `node --test`.
 */
export type RowActionDecision =
  | { action: 'create' }
  | { action: 'update' }
  | { action: 'skip_duplicate'; message: string }
  | { action: 'blocked'; message: string }

export function decideRowAction(mode: ImportMode, hasExistingMatch: boolean, externalId: string): RowActionDecision {
  if (hasExistingMatch) {
    if (mode === 'create') {
      return {
        action: 'skip_duplicate',
        message: `A question with external_id "${externalId}" already exists — it will be skipped (mode is create new only).`,
      }
    }
    return { action: 'update' }
  }

  if (mode === 'update') {
    return {
      action: 'blocked',
      message: `No existing question with external_id "${externalId}" — update-only mode cannot create it.`,
    }
  }

  return { action: 'create' }
}
