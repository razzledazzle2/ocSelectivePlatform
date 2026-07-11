/**
 * The single authoritative explanation shown after a question is answered.
 *
 * `short_explanation` is deprecated: it is no longer authored, exported or
 * rendered on its own. To avoid losing any legacy-only content, callers resolve
 * the solution as the worked solution first, falling back to the legacy short
 * explanation when the worked solution is empty.
 */
export function resolveSolution(
  workedSolution: string | null | undefined,
  shortExplanation: string | null | undefined
): string | null {
  if (workedSolution && workedSolution.trim()) return workedSolution
  if (shortExplanation && shortExplanation.trim()) return shortExplanation
  return null
}
