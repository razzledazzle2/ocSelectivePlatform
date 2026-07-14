'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  applyMutationResult,
  computeShiftRange,
  createEmptySelection,
  effectiveSelectedCount,
  enterAllMatching,
  headerCheckboxState,
  isRowSelected,
  toggleAllVisible,
  toggleRow,
  toggleRows,
  toSelectionInput,
  type HeaderCheckboxState,
  type QuestionSelectionState,
} from '@/lib/questions/bulk-selection-model'
import type { AdminQuestionFilters, BulkQuestionMutationResult } from '@/lib/types'

interface UseQuestionSelectionOptions {
  /** Ids of the currently rendered/sorted page, in display order — shift-click ranges never cross pages. */
  visibleIds: string[]
  /** A key that changes whenever any filter changes (but not page/pageSize/sort). A change clears the selection. */
  filterKey: string
  /** A key that changes whenever the sort order changes. A change only resets the shift-click anchor. */
  sortKey: string
}

/**
 * Selection state for the question bank table: explicit checked ids (persists
 * across pages/page-size changes) or an all-matching-filters selection
 * (server-resolved, never an id list in the browser) — see
 * bulk-selection-model.ts for the underlying pure state machine.
 */
export function useQuestionSelection({ visibleIds, filterKey, sortKey }: UseQuestionSelectionOptions) {
  const [state, setState] = useState<QuestionSelectionState>(createEmptySelection)
  const anchorRef = useRef<string | null>(null)

  const filterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey
      anchorRef.current = null
      setState(createEmptySelection())
    }
  }, [filterKey])

  const sortKeyRef = useRef(sortKey)
  useEffect(() => {
    if (sortKeyRef.current !== sortKey) {
      sortKeyRef.current = sortKey
      anchorRef.current = null
    }
  }, [sortKey])

  useEffect(() => {
    if (anchorRef.current && !visibleIds.includes(anchorRef.current)) {
      anchorRef.current = null
    }
  }, [visibleIds])

  /** Row checkbox click/change. Shift-click (with a live anchor on the same page) applies the whole in-between range. */
  const toggle = useCallback(
    (id: string, checked: boolean, shiftKey: boolean) => {
      setState((current) => {
        if (shiftKey && anchorRef.current) {
          const range = computeShiftRange(visibleIds, anchorRef.current, id)
          if (range) {
            anchorRef.current = id
            return toggleRows(current, range, checked)
          }
        }
        anchorRef.current = id
        return toggleRow(current, id, checked)
      })
    },
    [visibleIds]
  )

  const toggleAll = useCallback(() => {
    anchorRef.current = null
    setState((current) => toggleAllVisible(current, visibleIds))
  }, [visibleIds])

  const clear = useCallback(() => {
    anchorRef.current = null
    setState(createEmptySelection())
  }, [])

  const selectAllMatching = useCallback(
    (filters: AdminQuestionFilters, cutoffTimestamp: string, matchedCount: number) => {
      anchorRef.current = null
      setState(enterAllMatching(filters, cutoffTimestamp, matchedCount))
    },
    []
  )

  /** After a bulk action: drop succeeded ids from an explicit selection, or collapse an all-matching one — see applyMutationResult. */
  const applyResult = useCallback((result: Pick<BulkQuestionMutationResult, 'succeededIds' | 'failed'>) => {
    setState((current) => applyMutationResult(current, result))
  }, [])

  return {
    state,
    isSelected: (id: string) => isRowSelected(state, id),
    selectedCount: effectiveSelectedCount(state),
    headerState: headerCheckboxState(state, visibleIds) as HeaderCheckboxState,
    toggle,
    toggleAll,
    clear,
    selectAllMatching,
    applyResult,
    toSelectionInput: () => toSelectionInput(state),
  }
}
