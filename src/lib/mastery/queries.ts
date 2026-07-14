/**
 * Server reads for Student Subtopic Mastery.
 *
 * Every figure is derived from the EXISTING raw attempt history
 * (public.question_attempts) — nothing is pre-aggregated, nothing is destroyed.
 * The heavy lifting (formula, states, roll-up, ranking) is the pure code in
 * ./core; this module only fetches and wires.
 *
 * Attempts carry a canonical taxonomy snapshot (subtopic_code / skill_code /
 * pattern_key) written by the migration + trigger in
 * `20260710111443_add_attempt_taxonomy_snapshot.sql`. Until that migration is
 * pushed, `fetchAttemptRows` transparently falls back to resolving the codes
 * through the questions table so the feature still works.
 */
import { createClient } from '@/lib/supabase/server'
import { getDomain, getSkill, getSubject, getSubtopic } from '@/lib/taxonomy'
import type { ExamType } from '@/lib/types'
import {
  MASTERY_SUBJECT_CODES,
  RECOMMENDATION,
  accuracyTrend,
  buildSubjectMastery,
  computeSubtopicMastery,
  difficultyPerformance,
  evidenceKey,
  rankRecommendations,
} from './core'
import type {
  MasteryAttempt,
  MasteryRecommendation,
  SkillBreakdownRow,
  SubjectMastery,
  SubtopicMasteryDetail,
} from './types'

/** Asset statuses that mean "not ready" — mirrors the publish gate and coverage. */
const NOT_READY_ASSET_STATUSES = new Set(['pending', 'rejected'])

const BATCH_SIZE = 1000

/** Postgres "column does not exist" — the taxonomy-snapshot migration is not pushed yet. */
const UNDEFINED_COLUMN = '42703'

const RECENT_ATTEMPTS_SHOWN = 10

/* -------------------------------------------------------------------------- */
/* Attempt history                                                             */
/* -------------------------------------------------------------------------- */

interface AttemptRow extends MasteryAttempt {
  subtopicCode: string | null
}

const ATTEMPT_SELECT =
  'question_id, is_correct, difficulty, attempted_at, subtopic_code, skill_code, pattern_key'

function toAttemptRow(row: {
  question_id: string
  is_correct: boolean
  difficulty: number | null
  attempted_at: string
  subtopic_code: string | null
  skill_code: string | null
  pattern_key: string | null
}): AttemptRow {
  return {
    questionId: row.question_id,
    isCorrect: row.is_correct,
    difficulty: row.difficulty,
    attemptedAt: row.attempted_at,
    subtopicCode: row.subtopic_code,
    skillCode: row.skill_code,
    patternKey: row.pattern_key,
  }
}

/**
 * Fetches EVERY matching attempt row for a student, page by page. Mastery scores
 * from the raw history (recency weighting, evidence caps, ever-mastered replay),
 * so it must see the whole history — an arbitrary cap would silently drop the
 * oldest attempts and skew scores for heavy users. Paged by (attempted_at desc,
 * id desc), a total order, so offset paging never skips or duplicates a row.
 * Passing `subtopicCode` narrows the scan to one subtopic (uses the
 * student+subtopic index) for the subtopic detail view.
 */
async function fetchAllAttemptPages<T>(
  select: string,
  studentId: string,
  subtopicCode?: string
): Promise<T[]> {
  const supabase = await createClient()
  const rows: T[] = []

  for (let from = 0; ; from += BATCH_SIZE) {
    let query = supabase
      .from('question_attempts')
      .select(select)
      .eq('student_id', studentId)

    if (subtopicCode) {
      query = query.eq('subtopic_code', subtopicCode)
    }

    const { data, error } = await query
      .order('attempted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + BATCH_SIZE - 1)

    if (error) {
      throw error
    }

    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) {
      break
    }
  }

  return rows
}

/**
 * Pre-migration fallback: read the attempts without their taxonomy snapshot and
 * resolve the codes from the questions themselves. Attempts on questions the
 * student can no longer read (archived) resolve to null and are reported as
 * legacy attempts rather than being silently attributed to a subtopic.
 */
async function fetchAttemptRowsViaQuestions(studentId: string): Promise<AttemptRow[]> {
  const supabase = await createClient()
  let rows: Array<{
    question_id: string
    is_correct: boolean
    difficulty: number | null
    attempted_at: string
  }>
  try {
    rows = await fetchAllAttemptPages('question_id, is_correct, difficulty, attempted_at', studentId)
  } catch {
    throw new Error('Unable to load your practice history.')
  }
  const ids = [...new Set(rows.map((row) => row.question_id))]
  const taxonomy = new Map<string, { subtopic: string | null; skill: string | null; pattern: string | null }>()

  for (let from = 0; from < ids.length; from += BATCH_SIZE) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, subtopic_code, skill_code, pattern_key')
      .in('id', ids.slice(from, from + BATCH_SIZE))

    for (const question of (questions ?? []) as Array<{
      id: string
      subtopic_code: string | null
      skill_code: string | null
      pattern_key: string | null
    }>) {
      taxonomy.set(question.id, {
        subtopic: question.subtopic_code,
        skill: question.skill_code,
        pattern: question.pattern_key,
      })
    }
  }

  return rows.map((row) => {
    const codes = taxonomy.get(row.question_id)
    return {
      questionId: row.question_id,
      isCorrect: row.is_correct,
      difficulty: row.difficulty,
      attemptedAt: row.attempted_at,
      subtopicCode: codes?.subtopic ?? null,
      skillCode: codes?.skill ?? null,
      patternKey: codes?.pattern ?? null,
    }
  })
}

/**
 * The student's whole attempt history, with its canonical taxonomy snapshot.
 * Pass `subtopicCode` to scan a single subtopic (subtopic detail view) — the
 * only caller that needs one subtopic in isolation.
 */
async function fetchAttemptRows(studentId: string, subtopicCode?: string): Promise<AttemptRow[]> {
  type RawRow = Parameters<typeof toAttemptRow>[0]
  let data: RawRow[]
  try {
    data = await fetchAllAttemptPages<RawRow>(ATTEMPT_SELECT, studentId, subtopicCode)
  } catch (error) {
    if ((error as { code?: string })?.code === UNDEFINED_COLUMN) {
      return fetchAttemptRowsViaQuestions(studentId)
    }
    throw new Error('Unable to load your practice history.')
  }

  return data.map((row) => toAttemptRow(row))
}

/** Groups attempts by canonical subtopic; rows with no subtopic are counted separately. */
function groupBySubtopic(rows: AttemptRow[]): {
  bySubtopic: Map<string, MasteryAttempt[]>
  legacyAttempts: number
} {
  const bySubtopic = new Map<string, MasteryAttempt[]>()
  let legacyAttempts = 0

  for (const row of rows) {
    // An attempt whose subtopic no longer exists in the taxonomy is legacy data:
    // never guess a placement for it.
    if (!row.subtopicCode || !getSubtopic(row.subtopicCode)) {
      legacyAttempts += 1
      continue
    }
    const list = bySubtopic.get(row.subtopicCode) ?? []
    list.push(row)
    bySubtopic.set(row.subtopicCode, list)
  }

  return { bySubtopic, legacyAttempts }
}

/* -------------------------------------------------------------------------- */
/* Practice-ready question availability                                        */
/* -------------------------------------------------------------------------- */

export interface PracticeReadyQuestion {
  id: string
  subtopicCode: string
  skillCode: string | null
  patternKey: string | null
  difficulty: number | null
  examType: string | null
}

export interface SubtopicAvailability {
  questions: number
  patterns: number
}

/**
 * Questions a student may actually be served: published, from the bank, gradable
 * (single-choice with an answer key) and asset-ready. This is the same readiness
 * bar the publish gate and the coverage dashboard use.
 *
 * Pass `examType` to scope the pool to one program (OC/Selective) so availability
 * and recommendations reflect the student's active program.
 */
export async function getPracticeReadyQuestions(examType?: ExamType): Promise<PracticeReadyQuestion[]> {
  const supabase = await createClient()
  const rows: PracticeReadyQuestion[] = []

  // Independent of the paging loop below, so let it resolve alongside it. Matches
  // the helper's own "degrade to nothing blocked" behaviour if it cannot run.
  const blockedPromise = getAssetBlockedQuestionIds().catch(() => new Set<string>())

  for (let from = 0; ; from += BATCH_SIZE) {
    let builder = supabase
      .from('questions')
      .select('id, subtopic_code, skill_code, pattern_key, difficulty, exam_type')
      .eq('status', 'published')
      .eq('origin', 'bank')
      .eq('answer_format', 'single_choice')
      .is('deleted_at', null)
      .not('correct_option_label', 'is', null)
      .not('subtopic_code', 'is', null)

    if (examType) {
      builder = builder.eq('exam_type', examType)
    }

    const { data, error } = await builder
      .order('id', { ascending: true })
      .range(from, from + BATCH_SIZE - 1)

    if (error) {
      throw new Error('Unable to load the practice question bank.')
    }

    const batch = (data ?? []) as Array<{
      id: string
      subtopic_code: string
      skill_code: string | null
      pattern_key: string | null
      difficulty: number | null
      exam_type: string | null
    }>

    rows.push(
      ...batch.map((row) => ({
        id: row.id,
        subtopicCode: row.subtopic_code,
        skillCode: row.skill_code,
        patternKey: row.pattern_key,
        difficulty: row.difficulty,
        examType: row.exam_type,
      }))
    )

    if (batch.length < BATCH_SIZE) {
      break
    }
  }

  const blocked = await blockedPromise
  return rows.filter((row) => !blocked.has(row.id) && getSubtopic(row.subtopicCode) !== null)
}

/** Question ids whose linked assets are still pending or were rejected. */
async function getAssetBlockedQuestionIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const blocked = new Set<string>()
  const { data, error } = await supabase.from('question_assets').select('question_id, asset:assets(status)')

  if (error) {
    // Degrade to "nothing blocked" rather than emptying every practice pool.
    return blocked
  }

  for (const row of (data ?? []) as Array<{
    question_id: string
    asset: { status: string } | { status: string }[] | null
  }>) {
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset
    if (NOT_READY_ASSET_STATUSES.has(asset?.status ?? 'pending')) {
      blocked.add(row.question_id)
    }
  }

  return blocked
}

export function availabilityBySubtopic(
  questions: PracticeReadyQuestion[]
): Map<string, SubtopicAvailability> {
  const map = new Map<string, { questions: number; patterns: Set<string> }>()
  for (const question of questions) {
    const entry = map.get(question.subtopicCode) ?? { questions: 0, patterns: new Set<string>() }
    entry.questions += 1
    entry.patterns.add(evidenceKey({ questionId: question.id, patternKey: question.patternKey }))
    map.set(question.subtopicCode, entry)
  }
  return new Map(
    [...map].map(([code, entry]) => [code, { questions: entry.questions, patterns: entry.patterns.size }])
  )
}

/* -------------------------------------------------------------------------- */
/* Student-facing reads                                                        */
/* -------------------------------------------------------------------------- */

export interface StudentMasteryOverview {
  subjects: SubjectMastery[]
  recommendations: MasteryRecommendation[]
  availability: Map<string, SubtopicAvailability>
  /** Attempts that predate the canonical taxonomy (or sit on retired subtopics). */
  legacyAttempts: number
  hasAnyAttempts: boolean
}

/**
 * Subject overview: the whole tree plus what to practise next. `examType` scopes
 * question availability + recommendations to the active program (mastery scores
 * are computed from the whole attempt history, program-agnostic, unchanged).
 */
export async function getStudentMasteryOverview(
  studentId: string,
  examType?: ExamType
): Promise<StudentMasteryOverview> {
  const [attemptRows, readyQuestions] = await Promise.all([
    fetchAttemptRows(studentId),
    getPracticeReadyQuestions(examType),
  ])

  const { bySubtopic, legacyAttempts } = groupBySubtopic(attemptRows)
  const availability = availabilityBySubtopic(readyQuestions)

  const subjects = MASTERY_SUBJECT_CODES.map((code) => getSubject(code))
    .filter((subject): subject is NonNullable<typeof subject> => subject !== null)
    .map((subject) => buildSubjectMastery(subject, bySubtopic))

  const recommendations = rankRecommendations(
    subjects.flatMap((subject) =>
      subject.domains.flatMap((domain, domainIndex) =>
        domain.subtopics.map((mastery, subtopicIndex) => ({
          mastery,
          availableQuestions: availability.get(mastery.subtopicCode)?.questions ?? 0,
          // Taxonomy order: earlier domains/subtopics are the more foundational ones.
          importance: domainIndex * 10 + subtopicIndex,
        }))
      )
    ),
    { limit: RECOMMENDATION.limit }
  )

  return {
    subjects,
    recommendations,
    availability,
    legacyAttempts,
    hasAnyAttempts: attemptRows.length > 0,
  }
}

export interface DomainMasteryView {
  subject: { code: string; label: string }
  domain: SubjectMastery['domains'][number]
  availability: Map<string, SubtopicAvailability>
}

/** Domain drill-down. Null when the code is unknown or outside mastery's subjects. */
export async function getDomainMastery(
  studentId: string,
  domainCode: string,
  examType?: ExamType
): Promise<DomainMasteryView | null> {
  const domainNode = getDomain(domainCode)
  if (!domainNode || !isMasterySubject(domainNode.subjectCode)) {
    return null
  }

  const [attemptRows, readyQuestions] = await Promise.all([
    fetchAttemptRows(studentId),
    getPracticeReadyQuestions(examType),
  ])
  const { bySubtopic } = groupBySubtopic(attemptRows)
  const subjectNode = getSubject(domainNode.subjectCode)!
  const subject = buildSubjectMastery(subjectNode, bySubtopic)
  const domain = subject.domains.find((item) => item.domainCode === domainCode)
  if (!domain) {
    return null
  }

  return {
    subject: { code: subjectNode.code, label: subjectNode.label },
    domain,
    availability: availabilityBySubtopic(readyQuestions),
  }
}

function isMasterySubject(subjectCode: string): boolean {
  return (MASTERY_SUBJECT_CODES as readonly string[]).includes(subjectCode)
}

/** Subtopic detail: summary, trend, difficulty + skill breakdowns, recent attempts. */
export async function getSubtopicMasteryDetail(
  studentId: string,
  subtopicCode: string,
  examType?: ExamType
): Promise<(SubtopicMasteryDetail & { subject: { code: string; label: string }; domain: { code: string; label: string } }) | null> {
  const subtopicNode = getSubtopic(subtopicCode)
  if (!subtopicNode || !isMasterySubject(subtopicNode.subjectCode)) {
    return null
  }
  const domainNode = getDomain(subtopicNode.domainCode)!
  const subjectNode = getSubject(subtopicNode.subjectCode)!

  const [attemptRows, readyQuestions] = await Promise.all([
    // Scoped to this subtopic server-side; the filter below still guards the
    // pre-migration fallback path, which returns the whole history.
    fetchAttemptRows(studentId, subtopicCode),
    getPracticeReadyQuestions(examType),
  ])

  const attempts = attemptRows.filter((row) => row.subtopicCode === subtopicCode)
  const mastery = computeSubtopicMastery(subtopicNode, attempts, domainNode.label)
  const available = readyQuestions.filter((question) => question.subtopicCode === subtopicCode)

  return {
    subject: { code: subjectNode.code, label: subjectNode.label },
    domain: { code: domainNode.code, label: domainNode.label },
    mastery,
    skillBreakdown: buildSkillBreakdown(attempts),
    difficultyPerformance: difficultyPerformance(attempts),
    accuracyTrend: accuracyTrend(attempts),
    recentAttempts: await buildRecentAttempts(attempts.slice(0, RECENT_ATTEMPTS_SHOWN)),
    availableQuestions: available.length,
    distinctAvailablePatterns: new Set(
      available.map((question) => evidenceKey({ questionId: question.id, patternKey: question.patternKey }))
    ).size,
  }
}

/** Skills are supporting detail: attempts without a skill roll into "General practice". */
function buildSkillBreakdown(attempts: MasteryAttempt[]): SkillBreakdownRow[] {
  const groups = new Map<string, { attempts: number; correct: number }>()
  for (const attempt of attempts) {
    const key = attempt.skillCode ?? ''
    const group = groups.get(key) ?? { attempts: 0, correct: 0 }
    group.attempts += 1
    if (attempt.isCorrect) group.correct += 1
    groups.set(key, group)
  }

  return [...groups]
    .map(([code, group]) => ({
      skillCode: code || null,
      skillLabel: code ? getSkill(code)?.label ?? 'Other' : 'General practice',
      attempts: group.attempts,
      correct: group.correct,
      accuracy: Math.round((group.correct / group.attempts) * 100),
    }))
    .sort((a, b) => b.attempts - a.attempts)
}

/** Adds the question text to the most recent attempts (published questions only). */
async function buildRecentAttempts(attempts: MasteryAttempt[]): Promise<SubtopicMasteryDetail['recentAttempts']> {
  if (attempts.length === 0) {
    return []
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('questions')
    .select('id, question_text')
    .in('id', [...new Set(attempts.map((attempt) => attempt.questionId))])

  const textById = new Map(
    ((data ?? []) as Array<{ id: string; question_text: string | null }>).map((row) => [row.id, row.question_text])
  )

  return attempts.map((attempt) => ({
    questionId: attempt.questionId,
    questionText: textById.get(attempt.questionId) ?? null,
    isCorrect: attempt.isCorrect,
    difficulty: attempt.difficulty,
    skillLabel: attempt.skillCode ? getSkill(attempt.skillCode)?.label ?? null : null,
    attemptedAt: attempt.attemptedAt,
  }))
}

/* -------------------------------------------------------------------------- */
/* Targeted practice                                                           */
/* -------------------------------------------------------------------------- */

export interface TargetedPracticeContext {
  candidates: Array<PracticeReadyQuestion & { recentAttemptRank: number | null }>
  recentAccuracy: number | null
}

/**
 * Everything `selectTargetedPractice` needs for one subtopic: the ready pool
 * (optionally narrowed to an exam type) annotated with how recently the student
 * saw each question, plus their recent accuracy for difficulty adaptation.
 */
export async function getTargetedPracticeContext(
  studentId: string,
  subtopicCode: string,
  examType?: string
): Promise<TargetedPracticeContext> {
  const [attemptRows, readyQuestions] = await Promise.all([
    fetchAttemptRows(studentId),
    getPracticeReadyQuestions(),
  ])

  // Rank 1 = the student's most recent attempt, over their whole history.
  const rankByQuestion = new Map<string, number>()
  attemptRows.forEach((row, index) => {
    if (!rankByQuestion.has(row.questionId)) {
      rankByQuestion.set(row.questionId, index + 1)
    }
  })

  const candidates = readyQuestions
    .filter((question) => question.subtopicCode === subtopicCode)
    .filter((question) => !examType || question.examType === examType)
    .map((question) => ({
      ...question,
      recentAttemptRank: rankByQuestion.get(question.id) ?? null,
    }))

  const subtopicAttempts = attemptRows.filter((row) => row.subtopicCode === subtopicCode)
  const mastery = computeSubtopicMastery(
    getSubtopic(subtopicCode)!,
    subtopicAttempts
  )

  return { candidates, recentAccuracy: mastery.recentAccuracy }
}

