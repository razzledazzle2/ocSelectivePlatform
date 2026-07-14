/**
 * Splits an id list into fixed-size chunks for sequential set-based
 * `.in('id', chunk)` statements. Callers pass BULK_QUESTION_CHUNK_SIZE (from
 * `@/lib/types`) explicitly rather than this module importing it — this file
 * has no dependencies on purpose, so it can be unit-tested directly with
 * node's test runner without needing the `@/` path alias.
 *
 * 250 keeps each generated `IN (...)` list and query plan small and
 * predictable while still turning a 250-question bulk action into one
 * statement (and a 501-question one into three: 250, 250, 1) instead of one
 * request per row. Chunks are always processed sequentially, never
 * concurrently — see bulk-mutations.ts.
 */
export function chunkIds(ids: readonly string[], size: number): string[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be positive.')
  }
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}
