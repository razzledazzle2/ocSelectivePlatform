/**
 * Server reads for the Question-Bank Coverage Dashboard.
 *
 * Everything is built from ONE slim scan of the questions table (no question
 * text), enriched with per-question asset readiness and recent mock usage, then
 * placed into the canonical taxonomy. The heavy lifting (metrics, states, audit)
 * is the pure code in ./core; this module only fetches + wires.
 */
import { createClient } from '@/lib/supabase/server'
import { getDomain, getSkill, getSubject, getSubtopic } from '@/lib/taxonomy'
import {
  COVERAGE_SUBJECT_CODES,
  RECENT_MOCK_WINDOW_DAYS,
  auditCoverage,
  buildSubjectCoverage,
} from './core'
import type { CoverageAudit, CoverageQuestion, DomainCoverage, SubjectCoverage, SubtopicCoverage } from './types'

/** Asset statuses that mean "not ready" (placeholder or rejected) — mirrors the publish gate. */
const NOT_READY_ASSET_STATUSES = new Set(['pending', 'rejected'])

const SCAN_BATCH_SIZE = 1000

interface QuestionScanRow {
  id: string
  domain_code: string | null
  subtopic_code: string | null
  skill_code: string | null
  pattern_key: string | null
  question_family: string | null
  stimulus_format: string | null
  difficulty: number | null
  status: string
  validation_status: string
  exam_type: string | null
  year_level: number | null
  tags: string[] | null
}

const QUESTION_SCAN_SELECT =
  'id, domain_code, subtopic_code, skill_code, pattern_key, question_family, stimulus_format, difficulty, status, validation_status, exam_type, year_level, tags'

/** All live (non-deleted) questions, slim columns only, batched past the 1k cap. */
async function scanQuestions(): Promise<QuestionScanRow[]> {
  const supabase = await createClient()
  const rows: QuestionScanRow[] = []
  for (let from = 0; ; from += SCAN_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('questions')
      .select(QUESTION_SCAN_SELECT)
      .is('deleted_at', null)
      // Coverage measures the bank; mock-only imported questions are excluded.
      .eq('origin', 'bank')
      .order('id', { ascending: true })
      .range(from, from + SCAN_BATCH_SIZE - 1)
    if (error) {
      throw new Error('Unable to load questions for coverage.')
    }
    const batch = (data ?? []) as unknown as QuestionScanRow[]
    rows.push(...batch)
    if (batch.length < SCAN_BATCH_SIZE) {
      break
    }
  }
  return rows
}

/** question_id -> the statuses of its linked assets (absent id ⇒ no assets). */
async function getAssetStatusesByQuestion(): Promise<Map<string, string[]>> {
  const supabase = await createClient()
  const map = new Map<string, string[]>()
  const { data, error } = await supabase
    .from('question_assets')
    .select('question_id, asset:assets(status)')
  if (error) {
    // Degrade gracefully: treat as no linked assets rather than failing the page.
    return map
  }
  for (const row of (data ?? []) as Array<{
    question_id: string
    asset: { status: string } | { status: string }[] | null
  }>) {
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset
    const list = map.get(row.question_id) ?? []
    list.push(asset?.status ?? 'pending')
    map.set(row.question_id, list)
  }
  return map
}

/** Set of question ids used in a mock exam sat within the recent window. */
async function getRecentlyUsedInMocks(): Promise<Set<string>> {
  const supabase = await createClient()
  const ids = new Set<string>()
  const cutoff = new Date(Date.now() - RECENT_MOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  for (let from = 0; ; from += SCAN_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('mock_exam_session_questions')
      .select('question_id, session:mock_exam_sessions!inner(started_at)')
      .gte('session.started_at', cutoff)
      .range(from, from + SCAN_BATCH_SIZE - 1)
    if (error) {
      // RLS / schema drift: degrade to "none recently used" rather than failing.
      break
    }
    const batch = (data ?? []) as Array<{ question_id: string }>
    for (const row of batch) {
      ids.add(row.question_id)
    }
    if (batch.length < SCAN_BATCH_SIZE) {
      break
    }
  }
  return ids
}

/** Resolves a question's canonical placement + flags any stale (unresolved) codes. */
function placeQuestion(row: QuestionScanRow): {
  subjectCode: string | null
  domainCode: string | null
  subtopicCode: string | null
  skillCode: string | null
  hasCanonicalTaxonomy: boolean
  unresolvedCodes: string[]
} {
  const unresolvedCodes: string[] = []

  const subtopic = row.subtopic_code ? getSubtopic(row.subtopic_code) : null
  if (row.subtopic_code && !subtopic) {
    unresolvedCodes.push(row.subtopic_code)
  }
  const domain = row.domain_code ? getDomain(row.domain_code) : null
  if (row.domain_code && !domain) {
    unresolvedCodes.push(row.domain_code)
  }
  const skillResolved = row.skill_code ? getSkill(row.skill_code) : null
  if (row.skill_code && !skillResolved) {
    unresolvedCodes.push(row.skill_code)
  }

  const subtopicCode = subtopic?.code ?? null
  const domainCode = subtopic?.domainCode ?? domain?.code ?? null
  const subjectCode = subtopic?.subjectCode ?? domain?.subjectCode ?? null

  return {
    subjectCode,
    domainCode,
    subtopicCode,
    skillCode: skillResolved?.code ?? null,
    hasCanonicalTaxonomy: subtopicCode !== null,
    unresolvedCodes,
  }
}

function toCoverageQuestion(
  row: QuestionScanRow,
  assetStatuses: string[] | undefined,
  recentMockIds: Set<string>
): CoverageQuestion {
  const statuses = assetStatuses ?? []
  const hasMissingAsset = statuses.some((s) => NOT_READY_ASSET_STATUSES.has(s))
  const placement = placeQuestion(row)
  return {
    id: row.id,
    subjectCode: placement.subjectCode,
    domainCode: placement.domainCode,
    subtopicCode: placement.subtopicCode,
    skillCode: placement.skillCode,
    patternKey: row.pattern_key,
    questionFamily: row.question_family,
    stimulusFormat: row.stimulus_format,
    difficulty: row.difficulty,
    status: row.status,
    validationStatus: row.validation_status,
    examType: row.exam_type,
    yearLevel: row.year_level,
    tags: row.tags ?? [],
    assetReady: !hasMissingAsset,
    hasMissingAsset,
    usedInMockRecently: recentMockIds.has(row.id),
    hasCanonicalTaxonomy: placement.hasCanonicalTaxonomy,
    unresolvedCodes: placement.unresolvedCodes,
  }
}

/** The flat CoverageQuestion list for the whole live bank (one scan + enrichers). */
export async function getCoverageQuestions(): Promise<CoverageQuestion[]> {
  const [rows, assetMap, recentMockIds] = await Promise.all([
    scanQuestions(),
    getAssetStatusesByQuestion(),
    getRecentlyUsedInMocks(),
  ])
  return rows.map((row) => toCoverageQuestion(row, assetMap.get(row.id), recentMockIds))
}

/** Builds coverage for each requested canonical subject code (skips unknown codes). */
export function buildCoverage(
  subjectCodes: readonly string[],
  questions: CoverageQuestion[]
): SubjectCoverage[] {
  const result: SubjectCoverage[] = []
  for (const code of subjectCodes) {
    const subject = getSubject(code)
    if (subject) {
      result.push(buildSubjectCoverage(subject, questions))
    }
  }
  return result
}

export interface CoverageOverview {
  subjects: SubjectCoverage[]
  audit: CoverageAudit
  /** Total live questions scanned (whole bank, all subjects). */
  totalQuestions: number
}

/** Top-level data for the coverage overview + audit (the two target subjects). */
export async function getCoverageOverview(): Promise<CoverageOverview> {
  const questions = await getCoverageQuestions()
  const subjects = buildCoverage(COVERAGE_SUBJECT_CODES, questions)
  const audit = auditCoverage(subjects, questions)
  return { subjects, audit, totalQuestions: questions.length }
}

export interface DomainCoverageView {
  subject: { code: string; label: string }
  domain: DomainCoverage
}

/** Coverage for a single domain (drill-down page). Null when the code is unknown. */
export async function getDomainCoverage(domainCode: string): Promise<DomainCoverageView | null> {
  const domainNode = getDomain(domainCode)
  if (!domainNode) {
    return null
  }
  const subjects = buildCoverage([domainNode.subjectCode], await getCoverageQuestions())
  const subject = subjects[0]
  const domain = subject?.domains.find((d) => d.code === domainCode)
  if (!subject || !domain) {
    return null
  }
  return { subject: { code: subject.code, label: subject.label }, domain }
}

/** One matching question in the subtopic-detail list (slim; no full text stored). */
export interface CoverageQuestionListItem {
  id: string
  preview: string
  status: string
  validationStatus: string
  difficulty: number | null
  patternKey: string | null
  skillCode: string | null
  assetReady: boolean
  usedInMockRecently: boolean
}

export interface SubtopicCoverageView {
  subject: { code: string; label: string }
  domain: { code: string; label: string }
  subtopic: SubtopicCoverage
  questions: CoverageQuestionListItem[]
  recentlyUsed: CoverageQuestionListItem[]
  truncated: boolean
}

const SUBTOPIC_LIST_CAP = 300

/** Full detail for one subtopic, including the matching question list. */
export async function getSubtopicCoverage(subtopicCode: string): Promise<SubtopicCoverageView | null> {
  const subtopicNode = getSubtopic(subtopicCode)
  if (!subtopicNode) {
    return null
  }
  const domainNode = getDomain(subtopicNode.domainCode)
  const subjectNode = getSubject(subtopicNode.subjectCode)
  if (!domainNode || !subjectNode) {
    return null
  }

  const allQuestions = await getCoverageQuestions()
  const subjectCoverage = buildSubjectCoverage(subjectNode, allQuestions)
  const domain = subjectCoverage.domains.find((d) => d.code === domainNode.code)
  const subtopic = domain?.subtopics.find((s) => s.code === subtopicCode)
  if (!subtopic) {
    return null
  }

  const recentMockIds = new Set(
    allQuestions.filter((q) => q.usedInMockRecently).map((q) => q.id)
  )

  // Fetch previews only for the (small) matching set.
  const matchingIds = allQuestions.filter((q) => q.subtopicCode === subtopicCode).map((q) => q.id)
  const previews = await getQuestionPreviews(matchingIds.slice(0, SUBTOPIC_LIST_CAP))

  const byId = new Map(allQuestions.map((q) => [q.id, q]))
  const items: CoverageQuestionListItem[] = matchingIds.slice(0, SUBTOPIC_LIST_CAP).map((id) => {
    const q = byId.get(id)!
    return {
      id,
      preview: previews.get(id) ?? '(no text)',
      status: q.status,
      validationStatus: q.validationStatus,
      difficulty: q.difficulty,
      patternKey: q.patternKey,
      skillCode: q.skillCode,
      assetReady: q.assetReady,
      usedInMockRecently: recentMockIds.has(id),
    }
  })

  return {
    subject: { code: subjectNode.code, label: subjectNode.label },
    domain: { code: domainNode.code, label: domainNode.label },
    subtopic,
    questions: items,
    recentlyUsed: items.filter((q) => q.usedInMockRecently),
    truncated: matchingIds.length > SUBTOPIC_LIST_CAP,
  }
}

/** id -> short preview for a bounded id set (batched). */
async function getQuestionPreviews(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) {
    return map
  }
  const supabase = await createClient()
  for (let from = 0; from < ids.length; from += SCAN_BATCH_SIZE) {
    const slice = ids.slice(from, from + SCAN_BATCH_SIZE)
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', slice)
    if (error) {
      break
    }
    for (const row of (data ?? []) as Array<{ id: string; question_text: string | null }>) {
      map.set(row.id, buildPreview(row.question_text))
    }
  }
  return map
}

function buildPreview(text: string | null): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  return clean.length > 120 ? `${clean.slice(0, 117)}…` : clean || '(no text)'
}
