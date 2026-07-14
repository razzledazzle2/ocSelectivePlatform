/**
 * Admin question-bank domain filtering (pure).
 *
 * A question's canonical domain is derived from its subtopic — the student
 * mastery/coverage views group purely by `subtopic_code -> domain` and never read
 * the stored `domain_code` (see `resolveCanonicalDomainCode`). So the admin domain
 * filter must match a question placed in a domain EITHER directly (`domain_code`)
 * OR through its subtopic, otherwise a question that carries a subtopic but a
 * NULL/blank `domain_code` is invisible in the admin bank while showing correctly
 * for students.
 *
 * This module holds no taxonomy or DB imports so `node --test` can load it
 * directly; the caller (queries.ts) resolves the domain's subtopic codes from the
 * taxonomy and passes them in — the same "pure core + taxonomy-aware wrapper"
 * split used by coverage/core.ts and mastery/core.ts.
 */

/**
 * The PostgREST `.or(...)` expression that matches every question belonging to
 * `domainCode` directly or through one of its `subtopicCodes`. Returns `null` when
 * the domain has no subtopics (e.g. the admin-only `writing` subject), in which
 * case the caller should fall back to a plain `domain_code` equality.
 *
 * Subtopic codes are globally unique in the taxonomy, so the `in` list can never
 * pull in a subtopic from another domain.
 */
export function buildDomainFilterOrExpression(
  domainCode: string,
  subtopicCodes: readonly string[]
): string | null {
  if (subtopicCodes.length === 0) {
    return null
  }
  return `domain_code.eq.${domainCode},subtopic_code.in.(${subtopicCodes.join(',')})`
}
