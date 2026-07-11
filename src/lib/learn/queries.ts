/**
 * Read layer for the consolidated "Learn & Practice" area.
 *
 * It unifies two things the student portal used to show on separate pages:
 *   - Subtopic Mastery (Mathematical Reasoning + Thinking Skills), which have a
 *     full mastery model, and
 *   - practice-only subjects (Reading), which have a question bank but no mastery
 *     scoring yet.
 *
 * Everything is scoped to the student's active program (OC/Selective) via the
 * `examType` argument: it restricts which questions are counted as available and
 * which recommendations surface. Mastery *scores* remain whole-history (the
 * formula is unchanged); only availability is program-scoped.
 */
import { getPracticeHubData } from '@/lib/dashboard/queries'
import {
  availabilityBySubtopic,
  getDomainMastery,
  getPracticeReadyQuestions,
  getStudentMasteryOverview,
  type SubtopicAvailability,
} from '@/lib/mastery/queries'
import { MASTERY_SUBJECT_CODES, type MasteryState } from '@/lib/mastery/core'
import type { MasteryRecommendation, SubjectMastery } from '@/lib/mastery/types'
import { getDomain, getStudentVisibleSubjects, getSubject } from '@/lib/taxonomy'
import type { AreaInsight, ExamType } from '@/lib/types'

export type LearnSubjectKind = 'mastery' | 'practice'

/** A domain summary rendered as a card on the landing page. */
export interface LearnDomainSummary {
  domainCode: string
  domainLabel: string
  subjectCode: string
  subtopicCount: number
  availableQuestions: number
  /** Mastery-only fields — null for practice-only subjects (e.g. Reading). */
  progressPercent: number | null
  masteredCount: number | null
  needsReviewCount: number | null
}

/** A subject the student can browse and practise. */
export interface LearnSubjectSummary {
  code: string
  label: string
  kind: LearnSubjectKind
  availableQuestions: number
  subtopicCount: number
  domains: LearnDomainSummary[]
  /** Mastery-only aggregates — null for practice-only subjects. */
  progressPercent: number | null
  masteredCount: number | null
  needsReviewCount: number | null
  attemptCount: number | null
  recentAccuracy: number | null
  startedSubtopicCount: number | null
}

/** Availability crosses the server boundary as a plain record, not a Map. */
export type LearnAvailabilityMap = Record<string, SubtopicAvailability>

export interface LearnPracticeData {
  program: ExamType
  subjects: LearnSubjectSummary[]
  /** Ranked "practise next" suggestions (mastery subjects only). */
  recommendations: MasteryRecommendation[]
  availability: LearnAvailabilityMap
  hasAnyAttempts: boolean
  legacyAttempts: number
  revisionDueCount: number
  revisionTopAreas: string[]
  hasEnoughInsightData: boolean
  weakest: AreaInsight | null
  strongest: AreaInsight | null
}

function sumAvailability(
  subtopicCodes: string[],
  availability: Map<string, SubtopicAvailability>
): number {
  return subtopicCodes.reduce((sum, code) => sum + (availability.get(code)?.questions ?? 0), 0)
}

function masterySubjectToSummary(
  subject: SubjectMastery,
  availability: Map<string, SubtopicAvailability>
): LearnSubjectSummary {
  const domains: LearnDomainSummary[] = subject.domains.map((domain) => ({
    domainCode: domain.domainCode,
    domainLabel: domain.domainLabel,
    subjectCode: domain.subjectCode,
    subtopicCount: domain.subtopicCount,
    availableQuestions: sumAvailability(
      domain.subtopics.map((subtopic) => subtopic.subtopicCode),
      availability
    ),
    progressPercent: domain.progressPercent,
    masteredCount: domain.masteredCount,
    needsReviewCount: domain.needsReviewCount,
  }))

  return {
    code: subject.subjectCode,
    label: subject.subjectLabel,
    kind: 'mastery',
    availableQuestions: domains.reduce((sum, domain) => sum + domain.availableQuestions, 0),
    subtopicCount: subject.subtopicCount,
    domains,
    progressPercent: subject.progressPercent,
    masteredCount: subject.masteredCount,
    needsReviewCount: subject.needsReviewCount,
    attemptCount: subject.attemptCount,
    recentAccuracy: subject.recentAccuracy,
    startedSubtopicCount: subject.startedSubtopicCount,
  }
}

/** A student-visible subject with a bank but no mastery model (e.g. Reading). */
function practiceOnlySubjectSummary(
  subjectCode: string,
  availability: Map<string, SubtopicAvailability>
): LearnSubjectSummary | null {
  const node = getSubject(subjectCode)
  if (!node || node.domains.length === 0) {
    return null
  }

  const domains: LearnDomainSummary[] = node.domains.map((domain) => ({
    domainCode: domain.code,
    domainLabel: domain.label,
    subjectCode: node.code,
    subtopicCount: domain.subtopics.length,
    availableQuestions: sumAvailability(
      domain.subtopics.map((subtopic) => subtopic.code),
      availability
    ),
    progressPercent: null,
    masteredCount: null,
    needsReviewCount: null,
  }))

  return {
    code: node.code,
    label: node.label,
    kind: 'practice',
    availableQuestions: domains.reduce((sum, domain) => sum + domain.availableQuestions, 0),
    subtopicCount: domains.reduce((sum, domain) => sum + domain.subtopicCount, 0),
    domains,
    progressPercent: null,
    masteredCount: null,
    needsReviewCount: null,
    attemptCount: null,
    recentAccuracy: null,
    startedSubtopicCount: null,
  }
}

/** Everything the Learn & Practice landing page renders, for one program. */
export async function getLearnPracticeData(
  studentId: string,
  program: ExamType
): Promise<LearnPracticeData> {
  const [overview, hub] = await Promise.all([
    getStudentMasteryOverview(studentId, program),
    getPracticeHubData(studentId),
  ])

  const masterySubjects = overview.subjects.map((subject) =>
    masterySubjectToSummary(subject, overview.availability)
  )

  // Student-visible subjects that are NOT mastery-tracked but have a bank
  // (currently Reading). Writing is not student-visible, so it never appears.
  const practiceOnlyCodes = getStudentVisibleSubjects()
    .map((subject) => subject.code)
    .filter((code) => !(MASTERY_SUBJECT_CODES as readonly string[]).includes(code))

  const practiceOnlySubjects = practiceOnlyCodes
    .map((code) => practiceOnlySubjectSummary(code, overview.availability))
    .filter((subject): subject is LearnSubjectSummary => subject !== null)

  return {
    program,
    subjects: [...masterySubjects, ...practiceOnlySubjects],
    recommendations: overview.recommendations,
    availability: Object.fromEntries(overview.availability),
    hasAnyAttempts: overview.hasAnyAttempts,
    legacyAttempts: overview.legacyAttempts,
    revisionDueCount: hub.revisionDue.dueCount,
    revisionTopAreas: hub.revisionDue.topAreas.map((area) => area.name),
    hasEnoughInsightData: hub.insights.hasEnoughData,
    weakest: hub.insights.weakest,
    strongest: hub.insights.strongest,
  }
}

/* -------------------------------------------------------------------------- */
/* Domain view                                                                 */
/* -------------------------------------------------------------------------- */

/** One subtopic row in a domain — mastery fields are null for practice-only. */
export interface LearnSubtopicRow {
  subtopicCode: string
  subtopicLabel: string
  domainCode: string
  availableQuestions: number
  state: MasteryState | null
  masteryPercent: number | null
  attemptCount: number | null
  recentAccuracy: number | null
  lastPractisedAt: string | null
}

export interface LearnDomainView {
  subject: { code: string; label: string; kind: LearnSubjectKind }
  domain: {
    code: string
    label: string
    subtopicCount: number
    availableQuestions: number
    progressPercent: number | null
    masteredCount: number | null
    needsReviewCount: number | null
    attemptCount: number | null
  }
  subtopics: LearnSubtopicRow[]
}

function isMasterySubjectCode(code: string): boolean {
  return (MASTERY_SUBJECT_CODES as readonly string[]).includes(code)
}

/**
 * Domain drill-down for either a mastery subject (rich rows) or a practice-only
 * subject (availability rows). Null when the domain code is unknown or not
 * student-visible.
 */
export async function getLearnDomainView(
  studentId: string,
  domainCode: string,
  program: ExamType
): Promise<LearnDomainView | null> {
  const masteryView = await getDomainMastery(studentId, domainCode, program)
  if (masteryView) {
    const { subject, domain, availability } = masteryView
    return {
      subject: { code: subject.code, label: subject.label, kind: 'mastery' },
      domain: {
        code: domain.domainCode,
        label: domain.domainLabel,
        subtopicCount: domain.subtopicCount,
        availableQuestions: sumAvailability(
          domain.subtopics.map((subtopic) => subtopic.subtopicCode),
          availability
        ),
        progressPercent: domain.progressPercent,
        masteredCount: domain.masteredCount,
        needsReviewCount: domain.needsReviewCount,
        attemptCount: domain.attemptCount,
      },
      subtopics: domain.subtopics.map((subtopic) => ({
        subtopicCode: subtopic.subtopicCode,
        subtopicLabel: subtopic.subtopicLabel,
        domainCode: subtopic.domainCode,
        availableQuestions: availability.get(subtopic.subtopicCode)?.questions ?? 0,
        state: subtopic.state,
        masteryPercent: subtopic.masteryPercent,
        attemptCount: subtopic.attemptCount,
        recentAccuracy: subtopic.recentAccuracy,
        lastPractisedAt: subtopic.lastPractisedAt,
      })),
    }
  }

  // Practice-only domain (e.g. Reading): build from the taxonomy + availability.
  return getPracticeOnlyDomainView(domainCode, program)
}

async function getPracticeOnlyDomainView(
  domainCode: string,
  program: ExamType
): Promise<LearnDomainView | null> {
  const domainNode = getDomain(domainCode)
  const subjectNode = domainNode ? getSubject(domainNode.subjectCode) : null
  if (!domainNode || !subjectNode || !subjectNode.studentVisible || isMasterySubjectCode(subjectNode.code)) {
    return null
  }

  const availability = availabilityBySubtopic(await getPracticeReadyQuestions(program))
  const subtopics: LearnSubtopicRow[] = domainNode.subtopics.map((subtopic) => ({
    subtopicCode: subtopic.code,
    subtopicLabel: subtopic.label,
    domainCode: domainNode.code,
    availableQuestions: availability.get(subtopic.code)?.questions ?? 0,
    state: null,
    masteryPercent: null,
    attemptCount: null,
    recentAccuracy: null,
    lastPractisedAt: null,
  }))

  return {
    subject: { code: subjectNode.code, label: subjectNode.label, kind: 'practice' },
    domain: {
      code: domainNode.code,
      label: domainNode.label,
      subtopicCount: domainNode.subtopics.length,
      availableQuestions: subtopics.reduce((sum, row) => sum + row.availableQuestions, 0),
      progressPercent: null,
      masteredCount: null,
      needsReviewCount: null,
      attemptCount: null,
    },
    subtopics,
  }
}
