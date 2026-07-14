import type { AdminQuestionFilters, BulkQuestionMutationResult, BulkQuestionSelectionInput } from '@/lib/types'

/**
 * Explicit selections work across pages (the client just keeps accumulating
 * ids in a Set as the admin navigates). All-matching selections never carry an
 * id list at all — the server re-resolves `filters` at action time, so this
 * state only needs to remember the filter snapshot, the server-issued matched
 * count/cutoff, and any rows the admin explicitly excluded afterwards.
 */
export type QuestionSelectionState =
  | { mode: 'explicit'; selectedIds: Set<string> }
  | {
      mode: 'allMatching'
      filters: AdminQuestionFilters
      cutoffTimestamp: string
      matchedCount: number
      excludedIds: Set<string>
    }

export function createEmptySelection(): QuestionSelectionState {
  return { mode: 'explicit', selectedIds: new Set() }
}

export function isRowSelected(state: QuestionSelectionState, id: string): boolean {
  return state.mode === 'explicit' ? state.selectedIds.has(id) : !state.excludedIds.has(id)
}

export function effectiveSelectedCount(state: QuestionSelectionState): number {
  return state.mode === 'explicit' ? state.selectedIds.size : Math.max(0, state.matchedCount - state.excludedIds.size)
}

export type HeaderCheckboxState = 'checked' | 'unchecked' | 'indeterminate'

/** Tri-state for the page header checkbox, based only on the currently rendered rows. */
export function headerCheckboxState(state: QuestionSelectionState, visibleIds: readonly string[]): HeaderCheckboxState {
  if (visibleIds.length === 0) {
    return 'unchecked'
  }
  const selectedCount = visibleIds.filter((id) => isRowSelected(state, id)).length
  if (selectedCount === 0) return 'unchecked'
  if (selectedCount === visibleIds.length) return 'checked'
  return 'indeterminate'
}

/** Toggles a single row. All-matching selections never gain new ids — a check just clears the exclusion. */
export function toggleRow(state: QuestionSelectionState, id: string, checked: boolean): QuestionSelectionState {
  if (state.mode === 'explicit') {
    const next = new Set(state.selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    return { mode: 'explicit', selectedIds: next }
  }
  const nextExcluded = new Set(state.excludedIds)
  if (checked) nextExcluded.delete(id)
  else nextExcluded.add(id)
  return { ...state, excludedIds: nextExcluded }
}

/** Applies the same checked state to a batch of ids (shift-click range, or a page-select). */
export function toggleRows(state: QuestionSelectionState, ids: readonly string[], checked: boolean): QuestionSelectionState {
  if (state.mode === 'explicit') {
    const next = new Set(state.selectedIds)
    for (const id of ids) {
      if (checked) next.add(id)
      else next.delete(id)
    }
    return { mode: 'explicit', selectedIds: next }
  }
  const nextExcluded = new Set(state.excludedIds)
  for (const id of ids) {
    if (checked) nextExcluded.delete(id)
    else nextExcluded.add(id)
  }
  return { ...state, excludedIds: nextExcluded }
}

/**
 * Header checkbox click: always page-scoped (per its "Select all questions on
 * this page" label), and always resolved in explicit terms — clicking it while
 * an all-matching selection is active exits that mode rather than trying to
 * exclude/include a whole page inside a filter-driven set.
 */
export function toggleAllVisible(state: QuestionSelectionState, visibleIds: readonly string[]): QuestionSelectionState {
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => isRowSelected(state, id))
  if (allSelected) {
    return createEmptySelection()
  }
  return { mode: 'explicit', selectedIds: new Set(visibleIds) }
}

/**
 * Inclusive id range between the shift-click anchor and the newly clicked row,
 * in the order the rows are currently rendered (so it naturally supports both
 * upward and downward ranges). Returns null when either row isn't part of the
 * currently visible/sorted page — a shift-click never reaches across pages.
 */
export function computeShiftRange(
  visibleIds: readonly string[],
  anchorId: string,
  targetId: string
): string[] | null {
  const anchorIndex = visibleIds.indexOf(anchorId)
  const targetIndex = visibleIds.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) {
    return null
  }
  const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  return visibleIds.slice(start, end + 1)
}

export function enterAllMatching(
  filters: AdminQuestionFilters,
  cutoffTimestamp: string,
  matchedCount: number
): QuestionSelectionState {
  return { mode: 'allMatching', filters, cutoffTimestamp, matchedCount, excludedIds: new Set() }
}

export function toSelectionInput(state: QuestionSelectionState): BulkQuestionSelectionInput {
  return state.mode === 'explicit'
    ? { mode: 'explicit', ids: [...state.selectedIds] }
    : {
        mode: 'allMatching',
        filters: state.filters,
        cutoffTimestamp: state.cutoffTimestamp,
        excludedIds: [...state.excludedIds],
      }
}

/**
 * How many failed/blocked ids we're willing to keep as an explicit
 * re-selectable set after an all-matching action. Above this, holding
 * thousands of ids in browser state just to let the admin "retry" isn't
 * practical — callers should show a summary instead.
 */
export const ALL_MATCHING_RETAIN_FAILED_LIMIT = 200

/**
 * Selection state after a bulk action completes. Explicit selections just
 * drop the ids that succeeded (failed/blocked ones stay selected so the admin
 * can inspect or retry them). All-matching selections collapse to an explicit
 * selection of the failed ids (small enough to hold) or clear entirely
 * (success, or too many failures to track individually — the result's counts
 * and warnings are the record of what happened at that scale).
 */
export function applyMutationResult(
  state: QuestionSelectionState,
  result: Pick<BulkQuestionMutationResult, 'succeededIds' | 'failed'>
): QuestionSelectionState {
  if (state.mode === 'explicit') {
    const succeeded = new Set(result.succeededIds)
    const next = new Set([...state.selectedIds].filter((id) => !succeeded.has(id)))
    return { mode: 'explicit', selectedIds: next }
  }
  if (result.failed.length === 0) {
    return createEmptySelection()
  }
  if (result.failed.length <= ALL_MATCHING_RETAIN_FAILED_LIMIT) {
    return { mode: 'explicit', selectedIds: new Set(result.failed.map((f) => f.questionId)) }
  }
  return createEmptySelection()
}
