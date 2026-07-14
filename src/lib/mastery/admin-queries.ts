/**
 * Admin analytics for Subtopic Mastery — an extension of the existing coverage
 * dashboard rather than a separate analytics application.
 *
 * It answers: who is practising each subtopic, how mastered are they on average,
 * how are students distributed across the mastery states, which subtopics are
 * commonly weak, and which subtopics the bank cannot yet support.
 *
 * Staff may read every attempt row under RLS ("question_attempts_students_read_own_or_staff"),
 * so this is one capped scan of the raw attempt table + the coverage scan. No
 * per-student aggregate is stored anywhere.
 */
import { createClient } from '@/lib/supabase/server'
import { getDomain, getSubject, getSubtopic } from '@/lib/taxonomy'
import { coverageStateFor, summariseQuestions } from '@/lib/coverage/core'
import { getCoverageQuestions } from '@/lib/coverage/queries'
import { MASTERY_STATES, MASTERY_SUBJECT_CODES, computeSubtopicMastery, type MasteryState } from './core'
import type { MasteryAttempt, SubtopicAnalytics, SubtopicAnalyticsRow } from './types'

/** Hard cap so one busy cohort cannot turn the admin page into a full-table scan. */
const ATTEMPT_SCAN_CAP = 20_000
const BATCH_SIZE = 1000
const UNDEFINED_COLUMN = '42703'

/** How many rows the "commonly weak" and "insufficient coverage" lists surface. */
const HIGHLIGHT_LIMIT = 10

interface StaffAttemptRow extends MasteryAttempt {
  studentId: string
  subtopicCode: string | null
}

function emptyStateCounts(): Record<MasteryState, number> {
  return Object.fromEntries(MASTERY_STATES.map((state) => [state, 0])) as Record<MasteryState, number>
}

/** Pre-migration fallback: resolve the taxonomy through questions (staff read all). */
async function scanAttemptsViaQuestions(): Promise<StaffAttemptRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_attempts')
    .select('student_id, question_id, is_correct, difficulty, attempted_at')
    .order('attempted_at', { ascending: false })
    .limit(ATTEMPT_SCAN_CAP)

  if (error) {
    throw new Error('Unable to load student attempts for mastery analytics.')
  }

  const rows = (data ?? []) as Array<{
    student_id: string
    question_id: string
    is_correct: boolean
    difficulty: number | null
    attempted_at: string
  }>

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

  return rows.map((row) => ({
    studentId: row.student_id,
    questionId: row.question_id,
    isCorrect: row.is_correct,
    difficulty: row.difficulty,
    attemptedAt: row.attempted_at,
    subtopicCode: taxonomy.get(row.question_id)?.subtopic ?? null,
    skillCode: taxonomy.get(row.question_id)?.skill ?? null,
    patternKey: taxonomy.get(row.question_id)?.pattern ?? null,
  }))
}

async function scanAttempts(): Promise<StaffAttemptRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_attempts')
    .select('student_id, question_id, is_correct, difficulty, attempted_at, subtopic_code, skill_code, pattern_key')
    .order('attempted_at', { ascending: false })
    .limit(ATTEMPT_SCAN_CAP)

  if (error) {
    if (error.code === UNDEFINED_COLUMN) {
      return scanAttemptsViaQuestions()
    }
    throw new Error('Unable to load student attempts for mastery analytics.')
  }

  return ((data ?? []) as Array<{
    student_id: string
    question_id: string
    is_correct: boolean
    difficulty: number | null
    attempted_at: string
    subtopic_code: string | null
    skill_code: string | null
    pattern_key: string | null
  }>).map((row) => ({
    studentId: row.student_id,
    questionId: row.question_id,
    isCorrect: row.is_correct,
    difficulty: row.difficulty,
    attemptedAt: row.attempted_at,
    subtopicCode: row.subtopic_code,
    skillCode: row.skill_code,
    patternKey: row.pattern_key,
  }))
}

/**
 * Per-subtopic mastery analytics across every student. Each (student, subtopic)
 * pair is scored with the exact same pure formula the student sees, so the admin
 * view can never disagree with the student view.
 */
export async function getSubtopicMasteryAnalytics(): Promise<SubtopicAnalytics> {
  const [attempts, coverageQuestions] = await Promise.all([scanAttempts(), getCoverageQuestions()])

  const byStudentSubtopic = new Map<string, MasteryAttempt[]>()
  const studentsWithAttempts = new Set<string>()
  let legacyAttempts = 0

  for (const attempt of attempts) {
    studentsWithAttempts.add(attempt.studentId)
    if (!attempt.subtopicCode || !getSubtopic(attempt.subtopicCode)) {
      legacyAttempts += 1
      continue
    }
    const key = `${attempt.studentId}::${attempt.subtopicCode}`
    const list = byStudentSubtopic.get(key) ?? []
    list.push(attempt)
    byStudentSubtopic.set(key, list)
  }

  // Bank coverage per subtopic, from the same scan the coverage dashboard uses.
  const coverageBySubtopic = new Map<string, ReturnType<typeof summariseQuestions>>()
  const grouped = new Map<string, typeof coverageQuestions>()
  for (const question of coverageQuestions) {
    if (!question.subtopicCode) continue
    const list = grouped.get(question.subtopicCode) ?? []
    list.push(question)
    grouped.set(question.subtopicCode, list)
  }
  for (const [code, questions] of grouped) {
    coverageBySubtopic.set(code, summariseQuestions(questions))
  }

  const accumulator = new Map<
    string,
    { students: Set<string>; masterySum: number; masteryCount: number; states: Record<MasteryState, number> }
  >()

  for (const [key, studentAttempts] of byStudentSubtopic) {
    const [studentId, subtopicCode] = key.split('::')
    const subtopicNode = getSubtopic(subtopicCode)!
    const mastery = computeSubtopicMastery(subtopicNode, studentAttempts)

    const entry = accumulator.get(subtopicCode) ?? {
      students: new Set<string>(),
      masterySum: 0,
      masteryCount: 0,
      states: emptyStateCounts(),
    }
    entry.students.add(studentId)
    entry.states[mastery.state] += 1
    if (mastery.masteryPercent !== null) {
      entry.masterySum += mastery.masteryPercent
      entry.masteryCount += 1
    }
    accumulator.set(subtopicCode, entry)
  }

  const rows: SubtopicAnalyticsRow[] = []
  for (const subjectCode of MASTERY_SUBJECT_CODES) {
    for (const [subtopicCode, entry] of accumulator) {
      const subtopicNode = getSubtopic(subtopicCode)!
      if (subtopicNode.subjectCode !== subjectCode) continue
      rows.push(buildRow(subtopicNode, entry, coverageBySubtopic.get(subtopicCode)))
    }
  }

  // Subtopics nobody has touched still matter to admins when the bank is thin.
  for (const [subtopicCode, metrics] of coverageBySubtopic) {
    const subtopicNode = getSubtopic(subtopicCode)
    if (!subtopicNode || accumulator.has(subtopicCode)) continue
    if (!(MASTERY_SUBJECT_CODES as readonly string[]).includes(subtopicNode.subjectCode)) continue
    rows.push(
      buildRow(
        subtopicNode,
        { students: new Set(), masterySum: 0, masteryCount: 0, states: emptyStateCounts() },
        metrics
      )
    )
  }

  rows.sort((a, b) => b.studentsPractising - a.studentsPractising || a.subtopicLabel.localeCompare(b.subtopicLabel))

  const weakest = rows
    .filter((row) => row.averageMastery !== null)
    .sort((a, b) => a.averageMastery! - b.averageMastery!)
    .slice(0, HIGHLIGHT_LIMIT)

  const insufficientCoverage = rows
    .filter((row) => row.insufficientCoverage)
    .sort((a, b) => a.usableQuestions - b.usableQuestions)
    .slice(0, HIGHLIGHT_LIMIT)

  return {
    rows,
    weakest,
    insufficientCoverage,
    studentsWithAttempts: studentsWithAttempts.size,
    attemptsScanned: attempts.length,
    truncated: attempts.length >= ATTEMPT_SCAN_CAP,
    legacyAttempts,
  }
}

function buildRow(
  subtopicNode: NonNullable<ReturnType<typeof getSubtopic>>,
  entry: { students: Set<string>; masterySum: number; masteryCount: number; states: Record<MasteryState, number> },
  metrics: ReturnType<typeof summariseQuestions> | undefined
): SubtopicAnalyticsRow {
  const usable = metrics?.usable ?? 0
  const usablePatternKeys = metrics?.usablePatternKeys ?? 0

  return {
    subjectCode: subtopicNode.subjectCode,
    subjectLabel: getSubject(subtopicNode.subjectCode)?.label ?? subtopicNode.subjectCode,
    domainCode: subtopicNode.domainCode,
    domainLabel: getDomain(subtopicNode.domainCode)?.label ?? subtopicNode.domainCode,
    subtopicCode: subtopicNode.code,
    subtopicLabel: subtopicNode.label,
    studentsPractising: entry.students.size,
    averageMastery: entry.masteryCount === 0 ? null : Math.round(entry.masterySum / entry.masteryCount),
    stateCounts: entry.states,
    usableQuestions: usable,
    usablePatternKeys,
    // "Critical" bank coverage is exactly the case where mastery cannot be earned.
    insufficientCoverage: metrics === undefined || coverageStateFor(metrics) === 'critical',
  }
}
