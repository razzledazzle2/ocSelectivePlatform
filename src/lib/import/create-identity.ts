/**
 * Identity policy for imported questions.
 *
 * A question's identity is its explicit import identifier — the `external_id` — and
 * NOTHING else. Question wording, options, correct answer, stimulus text, title, or a
 * hash of any of those are deliberately never part of identity.
 *
 * This is what lets two questions with identical wording coexist as separate bank
 * entries, e.g. the same comprehension prompt asked of two different passages:
 *
 *   Stimulus A "The River Journey"  → "What is the main purpose of the passage?"
 *   Stimulus B "The Mountain Path"  → "What is the main purpose of the passage?"
 *
 * Both rows carry distinct `external_id`s, so both are imported. Matching text is not a
 * duplicate. The only reason a create row is skipped is an `external_id` collision with a
 * row already in the bank (idempotent re-import / race guard) — never its content.
 *
 * Kept free of `@/` runtime imports so it is directly unit-testable with `node --test`.
 */

/** The single field that establishes a create row's identity. */
export interface CreateRowIdentity {
  /** The explicit import identifier. Required for every importable row. */
  externalId: string | null
}

/**
 * True only when this row's `external_id` already exists in the bank. Content is never
 * consulted — two rows with identical wording but different `external_id`s never collide.
 */
export function createRowExternalIdCollides(
  row: CreateRowIdentity,
  existingExternalIds: ReadonlySet<string>
): boolean {
  return row.externalId !== null && row.externalId !== '' && existingExternalIds.has(row.externalId)
}

/**
 * Splits create rows into those to insert and those to skip, using `external_id` identity
 * only. Mirrors the create loop: an inserted row's `external_id` joins the seen set so a
 * later row reusing it (which validation already blocks in-file) is still guarded here.
 *
 * Rows without an `external_id` are never treated as duplicates by content — they flow
 * through to insertion. (Validation requires an `external_id` on every importable row, so
 * this is a defensive default, not a supported path.)
 */
export function partitionCreateRowsByIdentity<T extends CreateRowIdentity>(
  rows: readonly T[],
  existingExternalIds: ReadonlySet<string>
): { toInsert: T[]; skipped: T[] } {
  const seen = new Set(existingExternalIds)
  const toInsert: T[] = []
  const skipped: T[] = []
  for (const row of rows) {
    if (createRowExternalIdCollides(row, seen)) {
      skipped.push(row)
      continue
    }
    if (row.externalId) {
      seen.add(row.externalId)
    }
    toInsert.push(row)
  }
  return { toInsert, skipped }
}
