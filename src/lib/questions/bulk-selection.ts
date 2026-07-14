import { applyAdminQuestionFilters, resolveAssetStateConstraint } from '@/lib/questions/queries'
import { createClient } from '@/lib/supabase/server'
import type { AdminQuestionFilters, BulkQuestionSelectionInput, BulkSelectionPreview } from '@/lib/types'

/** Same batch size as getQuestionsForFullExport's full-bank export loop — keeps every large, unbounded scan in this codebase consistent. */
const RESOLVE_BATCH_SIZE = 1000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Drops anything that isn't a well-formed UUID. Explicit selections and
 * all-matching exclusions both arrive as plain string arrays from a server
 * action's JSON body — untrusted input. Malformed values are silently
 * dropped rather than erroring the whole action: a stray bad id shouldn't
 * block every other selected question, and every id here only ever reaches
 * the database inside a `.in()`/`.not(...,'in',...)` filter, never a raw SQL
 * fragment, so this is defense in depth against filter-string smuggling
 * rather than the primary safety boundary.
 */
export function sanitizeQuestionIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => UUID_PATTERN.test(id)))]
}

export interface ResolvedBulkSelection {
  ids: string[]
  matchedCount: number
}

/**
 * Turns a client-sent selection into a concrete list of question ids,
 * resolved entirely server-side. `explicit` selections are already a
 * (sanitized) id list. `allMatching` selections never trust anything the
 * client computed — filters are re-applied via the same
 * applyAdminQuestionFilters used by the admin list/count/export queries,
 * `cutoffTimestamp` excludes anything created after the admin opened the
 * "select all" banner, and `excludedIds` removes anything explicitly
 * unchecked afterwards. Large result sets are paginated server-side
 * (RESOLVE_BATCH_SIZE per round trip) rather than assuming one Supabase
 * response returns an unbounded number of ids.
 */
export async function resolveQuestionIdsForBulkAction(
  selection: BulkQuestionSelectionInput
): Promise<ResolvedBulkSelection> {
  if (selection.mode === 'explicit') {
    const ids = sanitizeQuestionIds(selection.ids)
    return { ids, matchedCount: ids.length }
  }

  const { filters, cutoffTimestamp, excludedIds } = selection
  if (!cutoffTimestamp || Number.isNaN(Date.parse(cutoffTimestamp))) {
    throw new Error('This selection has an invalid cutoff and cannot be resolved. Re-select and try again.')
  }
  const excluded = sanitizeQuestionIds(excludedIds)

  const supabase = await createClient()
  const assetIds = await resolveAssetStateConstraint(filters)
  const ids: string[] = []

  for (let from = 0; ; from += RESOLVE_BATCH_SIZE) {
    let query = applyAdminQuestionFilters(supabase.from('questions').select('id'), filters, assetIds)
      .lte('created_at', cutoffTimestamp)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + RESOLVE_BATCH_SIZE - 1)

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`)
    }

    const { data, error } = await query
    if (error) {
      throw new Error('Unable to resolve the questions matching this selection.')
    }

    const batch = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
    ids.push(...batch)

    if (batch.length < RESOLVE_BATCH_SIZE) {
      break
    }
  }

  return { ids, matchedCount: ids.length }
}

/**
 * Server-authoritative count + cutoff for the "Select all N questions
 * matching these filters" banner. The cutoff is stamped here (not on the
 * client) so it always reflects the database's clock, not the browser's.
 */
export async function getBulkSelectionPreview(filters: AdminQuestionFilters): Promise<BulkSelectionPreview> {
  const supabase = await createClient()
  const assetIds = await resolveAssetStateConstraint(filters)
  const cutoffTimestamp = new Date().toISOString()

  const countQuery = applyAdminQuestionFilters(
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    filters,
    assetIds
  ).lte('created_at', cutoffTimestamp)

  const { count, error } = await countQuery
  if (error) {
    throw new Error('Unable to count the questions matching these filters.')
  }

  return { matchedCount: count ?? 0, cutoffTimestamp }
}
