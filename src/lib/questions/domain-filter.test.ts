/**
 * Unit tests for the admin domain filter expression.
 * Run with:  node --test --experimental-strip-types "src/lib/questions/*.test.ts"
 * (wired to `npm test`). No test-runner dependency is required.
 *
 * These tests use the real canonical taxonomy plus a tiny in-memory stand-in for
 * a PostgREST query builder so we can assert the *behaviour* (which rows the
 * filter includes/excludes) without a database — mirroring how Supabase applies
 * `.or('domain_code.eq.X,subtopic_code.in.(...)')` against the questions table.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildDomainFilterOrExpression } from './domain-filter.ts'
import { getSubtopicCodesForDomain, resolveCanonicalDomainCode } from '../taxonomy/canonical-taxonomy.ts'

/** Mirrors how queries.ts builds the expression: taxonomy codes for the domain. */
function domainFilterOr(domainCode: string): string | null {
  return buildDomainFilterOrExpression(domainCode, getSubtopicCodesForDomain(domainCode))
}

/** The exact seat/snack logic-grid question from the bug report. */
const POPCORN = {
  id: 'popcorn',
  domain_code: null as string | null, // stored NULL — the defect
  subtopic_code: 'logic_grids_and_matching_constraints',
}

/** A well-formed question in the same domain (domain_code populated). */
const CONDITIONAL = {
  id: 'conditional',
  domain_code: 'logic_deduction' as string | null,
  subtopic_code: 'conditional_logic',
}

/** A question in a different domain entirely. */
const FRACTION = {
  id: 'fraction',
  domain_code: 'number_algebra' as string | null,
  subtopic_code: 'fractions',
}

/** A question whose subtopic sits in number_algebra but has NULL domain_code. */
const PERCENT_ORPHAN = {
  id: 'percent',
  domain_code: null as string | null,
  subtopic_code: 'percentages',
}

const ROWS = [POPCORN, CONDITIONAL, FRACTION, PERCENT_ORPHAN]

type Row = (typeof ROWS)[number]

/**
 * Evaluate the admin domain filter against a fixed row set, faithfully
 * reproducing how the query applies either the `.or()` expression or the
 * fall-back `domain_code` equality.
 */
function filterByDomain(rows: Row[], domainCode: string): Row[] {
  const orExpression = domainFilterOr(domainCode)
  if (!orExpression) {
    return rows.filter((r) => r.domain_code === domainCode)
  }
  // Parse "domain_code.eq.X,subtopic_code.in.(a,b,c)" the way PostgREST would.
  const [eqClause, inClause] = orExpression.split(',subtopic_code.in.(')
  const eqValue = eqClause.replace('domain_code.eq.', '')
  const inValues = new Set(inClause.replace(/\)$/, '').split(','))
  return rows.filter((r) => r.domain_code === eqValue || (r.subtopic_code !== null && inValues.has(r.subtopic_code)))
}

test('domain filter returns a question matched only through its subtopic (the popcorn bug)', () => {
  const result = filterByDomain(ROWS, 'logic_deduction').map((r) => r.id)
  assert.ok(result.includes('popcorn'), 'popcorn (NULL domain_code, logic subtopic) must appear under its domain')
})

test('domain filter includes questions placed directly via domain_code too', () => {
  const result = filterByDomain(ROWS, 'logic_deduction').map((r) => r.id)
  assert.ok(result.includes('conditional'))
})

test('domain filter excludes questions from other domains', () => {
  const result = filterByDomain(ROWS, 'logic_deduction').map((r) => r.id)
  assert.ok(!result.includes('fraction'))
  assert.ok(!result.includes('percent'))
})

test('domain filtering includes every subtopic in the domain (orphaned domain_code)', () => {
  const result = filterByDomain(ROWS, 'number_algebra').map((r) => r.id)
  assert.deepEqual(result.sort(), ['fraction', 'percent']) // percent has NULL domain_code
})

test('the expression carries the full subtopic list for the domain', () => {
  const expr = domainFilterOr('logic_deduction')!
  assert.match(expr, /^domain_code\.eq\.logic_deduction,subtopic_code\.in\.\(/)
  assert.ok(expr.includes('logic_grids_and_matching_constraints'))
  assert.ok(expr.includes('truth_and_lies'))
})

test('a domain with no subtopics falls back to plain equality (null expression)', () => {
  // `writing` is admin-only and defines no domains/subtopics.
  assert.equal(domainFilterOr('writing'), null)
  assert.equal(domainFilterOr('not_a_real_domain'), null)
})

test('admin filter and student view resolve the popcorn question to the SAME domain', () => {
  // Student mastery groups by subtopic -> subtopic.domainCode.
  const studentDomain = resolveCanonicalDomainCode({
    domainCode: POPCORN.domain_code,
    subtopicCode: POPCORN.subtopic_code,
  })
  assert.equal(studentDomain, 'logic_deduction')
  // Admin filter now also surfaces it under that same domain.
  assert.ok(filterByDomain(ROWS, studentDomain!).some((r) => r.id === 'popcorn'))
})
