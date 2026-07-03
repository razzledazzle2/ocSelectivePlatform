import { createClient } from '@/lib/supabase/server'
import { getQuestionById } from '@/lib/questions/queries'
import { buildAttemptStats, computeQualitySignals, emptyAttemptStats } from '@/lib/reports/quality-signals'
import {
  ADMIN_PORTAL_ROLES,
  type AdminReportListItem,
  type QualitySignal,
  type QuestionAttemptStats,
  type QuestionOptionLabel,
  type QuestionStatus,
  type ReportDetail,
  type ReportFilters,
  type ReportQueueCounts,
  type ReportStatus,
  type ReportType,
  type QuestionReportDetailItem,
  type ReviewerOption,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

function buildQuestionPreview(questionText: string): string {
  const collapsed = questionText.replace(/\s+/g, ' ').trim()
  return collapsed.length > 110 ? `${collapsed.slice(0, 107)}...` : collapsed
}

function profileName(profile: { full_name: string | null; email: string | null } | null): string | null {
  if (!profile) {
    return null
  }
  return profile.full_name || profile.email || null
}

/** The Supabase row shape returned by the admin reports query (with embeds). */
interface ReportRow {
  id: string
  question_id: string
  report_type: ReportType
  message: string | null
  status: ReportStatus
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  question:
    | {
        id: string
        question_text: string
        status: QuestionStatus
        subject_id: string | null
        topic_id: string | null
        question_type_id: string | null
        subject: { name: string }[] | { name: string } | null
        topic: { name: string }[] | { name: string } | null
        question_type: { name: string }[] | { name: string } | null
      }[]
    | {
        id: string
        question_text: string
        status: QuestionStatus
        subject_id: string | null
        topic_id: string | null
        question_type_id: string | null
        subject: { name: string }[] | { name: string } | null
        topic: { name: string }[] | { name: string } | null
        question_type: { name: string }[] | { name: string } | null
      }
    | null
  reporter: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
  assignee: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
}

const REPORT_SELECT = `
  id,
  question_id,
  report_type,
  message,
  status,
  assigned_to,
  resolved_at,
  created_at,
  question:questions!question_reports_question_id_fkey(
    id,
    question_text,
    status,
    subject_id,
    topic_id,
    question_type_id,
    subject:subjects(name),
    topic:topics(name),
    question_type:question_types(name)
  ),
  reporter:profiles!question_reports_reporter_id_fkey(full_name, email),
  assignee:profiles!question_reports_assigned_to_fkey(full_name, email)
`

/**
 * Per-question aggregates keyed by question_id: total & open report counts, and
 * the practice-attempt stats used for quality signals. Fetched separately so the
 * counts reflect the WHOLE question, independent of the current list filters.
 */
async function getQuestionAggregates(questionIds: string[]): Promise<{
  reportCounts: Map<string, { total: number; open: number }>
  attemptStats: Map<string, QuestionAttemptStats>
}> {
  const reportCounts = new Map<string, { total: number; open: number }>()
  const attemptStats = new Map<string, QuestionAttemptStats>()

  if (questionIds.length === 0) {
    return { reportCounts, attemptStats }
  }

  const supabase = await createClient()

  const [{ data: reportRows }, { data: attemptRows }] = await Promise.all([
    supabase.from('question_reports').select('question_id, status').in('question_id', questionIds),
    supabase
      .from('question_attempts')
      .select('question_id, is_correct, selected_option_label, time_taken_seconds')
      .in('question_id', questionIds),
  ])

  for (const row of (reportRows ?? []) as Array<{ question_id: string; status: ReportStatus }>) {
    const entry = reportCounts.get(row.question_id) ?? { total: 0, open: 0 }
    entry.total += 1
    if (row.status === 'open') {
      entry.open += 1
    }
    reportCounts.set(row.question_id, entry)
  }

  const attemptsByQuestion = new Map<
    string,
    Array<{ is_correct: boolean; selected_option_label: QuestionOptionLabel; time_taken_seconds: number | null }>
  >()
  for (const row of (attemptRows ?? []) as Array<{
    question_id: string
    is_correct: boolean
    selected_option_label: QuestionOptionLabel
    time_taken_seconds: number | null
  }>) {
    const list = attemptsByQuestion.get(row.question_id) ?? []
    list.push({
      is_correct: row.is_correct,
      selected_option_label: row.selected_option_label,
      time_taken_seconds: row.time_taken_seconds,
    })
    attemptsByQuestion.set(row.question_id, list)
  }

  for (const questionId of questionIds) {
    attemptStats.set(questionId, buildAttemptStats(attemptsByQuestion.get(questionId) ?? []))
  }

  return { reportCounts, attemptStats }
}

/**
 * Loads the admin report queue. Direct report-column filters (status, type,
 * assignee) are applied in the query; question-derived filters (subject, topic,
 * type, question status) are applied in memory since the dataset is small and
 * this avoids brittle embedded-resource filtering.
 */
export async function getAdminReports(filters: ReportFilters = {}): Promise<AdminReportListItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from('question_reports')
    .select(REPORT_SELECT)
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.reportType) {
    query = query.eq('report_type', filters.reportType)
  }
  if (filters.assignedTo === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load question reports.')
  }

  const rows = ((data ?? []) as unknown as ReportRow[]).filter((row) => {
    const question = getRelationValue(row.question)
    if (!question) {
      return false
    }
    if (filters.subjectId && question.subject_id !== filters.subjectId) {
      return false
    }
    if (filters.topicId && question.topic_id !== filters.topicId) {
      return false
    }
    if (filters.questionTypeId && question.question_type_id !== filters.questionTypeId) {
      return false
    }
    if (filters.questionStatus && question.status !== filters.questionStatus) {
      return false
    }
    return true
  })

  const questionIds = Array.from(new Set(rows.map((row) => row.question_id)))
  const { reportCounts, attemptStats } = await getQuestionAggregates(questionIds)

  const signalsByQuestion = new Map<string, QualitySignal[]>()
  for (const questionId of questionIds) {
    const counts = reportCounts.get(questionId) ?? { total: 0, open: 0 }
    const stats = attemptStats.get(questionId) ?? emptyAttemptStats()
    signalsByQuestion.set(questionId, computeQualitySignals({ stats, openReportCount: counts.open }))
  }

  return rows.map((row) => {
    const question = getRelationValue(row.question)!
    const counts = reportCounts.get(row.question_id) ?? { total: 0, open: 0 }
    const assignee = getRelationValue(row.assignee)

    return {
      id: row.id,
      questionId: row.question_id,
      questionTextPreview: buildQuestionPreview(question.question_text),
      subjectName: getRelationValue(question.subject)?.name ?? 'Unassigned subject',
      topicName: getRelationValue(question.topic)?.name ?? 'Unassigned topic',
      questionTypeName: getRelationValue(question.question_type)?.name ?? null,
      questionStatus: question.status,
      reportType: row.report_type,
      message: row.message,
      status: row.status,
      reporterName: profileName(getRelationValue(row.reporter)),
      assignedToId: row.assigned_to,
      assignedToName: profileName(assignee),
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      questionReportCount: counts.total,
      questionOpenReportCount: counts.open,
      qualitySignals: signalsByQuestion.get(row.question_id) ?? [],
    }
  })
}

/** Summary counts across the whole queue, used for the header strip. */
export async function getReportQueueCounts(): Promise<ReportQueueCounts> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('question_reports').select('status')

  if (error) {
    throw new Error('Unable to load report counts.')
  }

  const counts: ReportQueueCounts = { open: 0, inReview: 0, resolved: 0, dismissed: 0, total: 0 }
  for (const row of (data ?? []) as Array<{ status: ReportStatus }>) {
    counts.total += 1
    if (row.status === 'open') counts.open += 1
    else if (row.status === 'in_review') counts.inReview += 1
    else if (row.status === 'resolved') counts.resolved += 1
    else if (row.status === 'dismissed') counts.dismissed += 1
  }
  return counts
}

/** Loads the full detail (question + every report + quality signals) for one question. */
export async function getReportDetail(questionId: string): Promise<ReportDetail | null> {
  const question = await getQuestionById(questionId)
  if (!question) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_reports')
    .select(`
      id,
      report_type,
      message,
      status,
      internal_note,
      resolved_at,
      created_at,
      reporter:profiles!question_reports_reporter_id_fkey(full_name, email),
      assignee:profiles!question_reports_assigned_to_fkey(full_name, email)
    `)
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Unable to load reports for this question.')
  }

  const reports: QuestionReportDetailItem[] = (
    (data ?? []) as unknown as Array<{
      id: string
      report_type: ReportType
      message: string | null
      status: ReportStatus
      internal_note: string | null
      resolved_at: string | null
      created_at: string
      reporter: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
      assignee: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
    }>
  ).map((row) => ({
    id: row.id,
    reportType: row.report_type,
    message: row.message,
    status: row.status,
    reporterName: profileName(getRelationValue(row.reporter)),
    assignedToName: profileName(getRelationValue(row.assignee)),
    internalNote: row.internal_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }))

  const { reportCounts, attemptStats } = await getQuestionAggregates([questionId])
  const counts = reportCounts.get(questionId) ?? { total: 0, open: 0 }
  const stats = attemptStats.get(questionId) ?? emptyAttemptStats()

  return {
    question,
    reports,
    stats,
    qualitySignals: computeQualitySignals({ stats, openReportCount: counts.open }),
  }
}

/**
 * Staff members who can be assigned a report. RLS limits what non-admins can
 * read here (a tutor may only see themselves); the list degrades gracefully.
 */
export async function getAssignableReviewers(): Promise<ReviewerOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', [...ADMIN_PORTAL_ROLES])
    .order('full_name', { ascending: true })

  if (error) {
    return []
  }

  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((row) => ({
    id: row.id,
    name: row.full_name || row.email || 'Unnamed reviewer',
  }))
}
