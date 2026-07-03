import type { LucideIcon } from 'lucide-react'

export const APP_ROLES = ['student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin'] as const
export const EXAM_TYPES = ['OC', 'Selective'] as const
export const QUESTION_STATUSES = ['draft', 'published', 'archived'] as const
export const QUESTION_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
export const QUESTION_SOURCES = ['manual', 'csv', 'bulk_paste'] as const
export const PRACTICE_MODES = ['practice'] as const
export const MISTAKE_STATUSES = ['needs_review', 'learning', 'improving', 'mastered'] as const
export const ADMIN_PORTAL_ROLES = ['tutor', 'admin', 'super_admin'] as const
export const STUDENT_PORTAL_ROLES = ['student', 'parent', 'external_customer'] as const

export type AppRole = (typeof APP_ROLES)[number]
export type ExamType = (typeof EXAM_TYPES)[number]
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]
export type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number]
export type QuestionSource = (typeof QUESTION_SOURCES)[number]
export type PracticeMode = (typeof PRACTICE_MODES)[number]
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number]
export type AdminPortalRole = (typeof ADMIN_PORTAL_ROLES)[number]
export type StudentPortalRole = (typeof STUDENT_PORTAL_ROLES)[number]

export interface AppProfile {
  id: string
  email: string | null
  full_name: string | null
  role: AppRole
}

export type NavigationIconName =
  | 'gauge'
  | 'book-open'
  | 'revision'
  | 'clipboard-list'
  | 'timer'
  | 'users'
  | 'flag'

export interface NavigationItem {
  href: string
  label: string
  icon: NavigationIconName
}

export type DashboardCardIcon = LucideIcon

export interface AuthPageSearchParams {
  error?: string | string[]
  message?: string | string[]
}

export interface SubjectRecord {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface TopicRecord {
  id: string
  subject_id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface QuestionTypeRecord {
  id: string
  subject_id: string
  topic_id: string | null
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface QuestionOptionRecord {
  id?: string
  question_id?: string
  label: QuestionOptionLabel
  option_text: string
  sort_order: number
  created_at?: string
}

export interface QuestionRecord {
  id: string
  subject_id: string
  topic_id: string
  question_type_id: string | null
  exam_type: ExamType
  year_level: number | null
  difficulty: number
  question_text: string
  passage_text: string | null
  short_explanation: string | null
  worked_solution: string
  correct_option_label: QuestionOptionLabel
  status: QuestionStatus
  source: QuestionSource
  tags: string[]
  created_by: string | null
  updated_by: string | null
  published_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface QuestionDetail extends QuestionRecord {
  subject: SubjectRecord
  topic: TopicRecord
  questionType: QuestionTypeRecord | null
  options: QuestionOptionRecord[]
}

export interface AdminQuestionFilters {
  examType?: string
  subjectId?: string
  topicId?: string
  difficulty?: string
  status?: string
  query?: string
}

export interface AdminQuestionListItem {
  id: string
  questionTextPreview: string
  subjectName: string
  topicName: string
  questionTypeName: string | null
  examType: ExamType
  difficulty: number
  status: QuestionStatus
  optionsCount: number
  correctOptionLabel: QuestionOptionLabel
  tags: string[]
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  archivedAt: string | null
}

export interface QuestionFormValues {
  examType: ExamType
  subjectId: string
  topicId: string
  questionTypeId: string
  yearLevel: string
  difficulty: string
  questionText: string
  passageText: string
  /** Option texts in label order (index 0 = A, 1 = B, ...). Length 4–5. */
  options: string[]
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string
  workedSolution: string
  /** Comma-separated in the form; split into text[] on write. */
  tags: string
  status: Extract<QuestionStatus, 'draft' | 'published'>
}

export interface QuestionWriteInput {
  examType: ExamType
  subjectId: string
  topicId: string
  questionTypeId: string | null
  yearLevel: number | null
  difficulty: number
  questionText: string
  passageText: string | null
  options: QuestionOptionRecord[]
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
  tags: string[]
  status: Extract<QuestionStatus, 'draft' | 'published'>
}

export interface ActionResult<T = undefined> {
  success: boolean
  message?: string
  data?: T
  fieldErrors?: Record<string, string>
}

export interface PracticeQuestionFilters {
  examType: ExamType
  subjectId: string
  topicId?: string
  difficulty?: number
  limit: number
}

export interface PracticeQuestionItem {
  id: string
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  questionTypeId: string | null
  questionTypeName: string | null
  examType: ExamType
  difficulty: number
  questionText: string
  passageText: string | null
  options: QuestionOptionRecord[]
}

export interface PracticeStartResult {
  sessionId: string
  startedAt: string
  questions: PracticeQuestionItem[]
}

export interface AttemptFeedback {
  attemptId: string
  isCorrect: boolean
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
}

/**
 * Feedback returned after a student submits an answer during Phase 1B practice.
 * Unlike AttemptFeedback, submitting this does NOT persist an attempt/session/mistake.
 */
export interface PracticeAnswerFeedback {
  isCorrect: boolean
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
}

export interface PracticeSessionSummary {
  sessionId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  accuracy: number
  totalTimeSeconds: number
}

export interface PracticeSessionRecord {
  id: string
  student_id: string
  mode: PracticeMode
  exam_type: ExamType | null
  subject_id: string | null
  topic_id: string | null
  difficulty: number | null
  total_questions: number
  correct_count: number
  incorrect_count: number
  accuracy: number | null
  total_time_seconds: number
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface RecentPracticeSession {
  id: string
  examType: ExamType | null
  subjectName: string | null
  topicName: string | null
  difficulty: number | null
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  accuracy: number | null
  totalTimeSeconds: number
  completedAt: string | null
  createdAt: string
}

export interface StudentMistakeQuestion {
  id: string
  studentId: string
  questionId: string
  subjectName: string | null
  topicName: string | null
  questionTypeName: string | null
  examType: ExamType | null
  difficulty: number | null
  timesIncorrect: number
  timesCorrectAfterMistake: number
  lastIncorrectAt: string
  lastAttemptedAt: string
  status: MistakeStatus
  questionText: string
  nextReviewAt: string | null
  correctStreak: number
  lastReviewedAt: string | null
  masteredAt: string | null
}

export type RevisionMode =
  | 'all'
  | 'due_today'
  | 'needs_review'
  | 'learning'
  | 'improving'
  | 'mastered'

export interface RevisionFilters {
  subjectName?: string
  topicName?: string
  questionTypeName?: string
}

export interface RevisionRetryFeedback {
  isCorrect: boolean
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
  status: MistakeStatus
  nextReviewAt: string | null
}

export interface RecentAttempt {
  id: string
  questionText: string
  subjectName: string | null
  topicName: string | null
  isCorrect: boolean
  attemptedAt: string
}

export interface MistakeQuestionDetail extends StudentMistakeQuestion {
  passageText: string | null
  shortExplanation: string | null
  workedSolution: string
  correctOptionLabel: QuestionOptionLabel
  options: QuestionOptionRecord[]
}

export interface StudentDashboardStats {
  questionsCompleted: number
  correctAnswers: number
  incorrectAnswers: number
  overallAccuracy: number | null
  revisionDueToday: number
  recentSessions: RecentPracticeSession[]
  recentAttempts: RecentAttempt[]
  recentMistakes: StudentMistakeQuestion[]
  weakestSubject: string | null
  weakestTopic: string | null
}

export interface DashboardMetrics {
  questionsThisWeek: number
  overallAccuracy: number | null
  currentStreak: number
  revisionDueToday: number
}

export interface StreakSummary {
  currentStreak: number
  longestStreak: number
  activeDaysThisMonth: number
  questionsThisWeek: number
}

export interface ActivityCalendarDay {
  date: string
  count: number
  active: boolean
}

export interface ActivityCalendar {
  monthLabel: string
  firstWeekday: number
  days: ActivityCalendarDay[]
}

export interface AreaInsight {
  subjectName: string
  topicName: string | null
  questionTypeName: string | null
  attempts: number
  correct: number
  accuracy: number
}

export interface WeakStrongInsights {
  hasEnoughData: boolean
  strongest: AreaInsight | null
  weakest: AreaInsight | null
}

export interface RevisionDueSummary {
  dueCount: number
  topAreas: Array<{ name: string; count: number }>
}

export interface DashboardRecommendation {
  id: string
  title: string
  description: string
  href: string
  ctaLabel: string
}

export interface StudentDashboardData {
  hasActivity: boolean
  metrics: DashboardMetrics
  streak: StreakSummary
  calendar: ActivityCalendar
  insights: WeakStrongInsights
  revisionDue: RevisionDueSummary
  recentSessions: RecentPracticeSession[]
  recommendations: DashboardRecommendation[]
}

export interface AdminDashboardStats {
  totalStudents: number
  totalStaff: number
  totalQuestions: number
  publishedQuestions: number
  draftQuestions: number
  archivedQuestions: number
  attemptsLast7Days: number
  activeMistakes: number
  recentStudents: AdminStudentRow[]
}

export interface AdminStudentRow {
  id: string
  fullName: string | null
  email: string | null
  role: AppRole
  createdAt: string
  questionsCompleted: number
  correctAnswers: number
  incorrectAnswers: number
  accuracy: number | null
  activeMistakes: number
  latestAttemptAt: string | null
}

// -- Phase 9: Question reports & quality control -------------------------------

export const REPORT_TYPES = [
  'wrong_answer',
  'unclear_solution',
  'typo',
  'multiple_correct_answers',
  'confusing_wording',
  'image_or_diagram_issue',
  'other',
] as const

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const

export type ReportType = (typeof REPORT_TYPES)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** Tone used to colour quality-signal and status badges. */
export type QualitySignalTone = 'critical' | 'warning' | 'neutral'

export type QualitySignalType =
  | 'multiple_reports'
  | 'low_accuracy'
  | 'common_wrong_answer'
  | 'high_avg_time'

export interface QualitySignal {
  type: QualitySignalType
  label: string
  detail: string
  tone: QualitySignalTone
}

/**
 * Aggregated, real practice-attempt data for a single question. Built only from
 * rows that actually exist in question_attempts — never fabricated.
 */
export interface QuestionAttemptStats {
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  totalTimeSeconds: number
  /** Count of each selected option label among INCORRECT attempts only. */
  wrongAnswerCounts: Partial<Record<QuestionOptionLabel, number>>
}

export interface ReportFilters {
  status?: string
  reportType?: string
  subjectId?: string
  topicId?: string
  questionTypeId?: string
  questionStatus?: string
  assignedTo?: string
}

export interface AdminReportListItem {
  id: string
  questionId: string
  questionTextPreview: string
  subjectName: string
  topicName: string
  questionTypeName: string | null
  questionStatus: QuestionStatus
  reportType: ReportType
  message: string | null
  status: ReportStatus
  reporterName: string | null
  assignedToId: string | null
  assignedToName: string | null
  createdAt: string
  resolvedAt: string | null
  /** Total reports (any status) attached to this question. */
  questionReportCount: number
  /** Open reports attached to this question. */
  questionOpenReportCount: number
  qualitySignals: QualitySignal[]
}

export interface QuestionReportDetailItem {
  id: string
  reportType: ReportType
  message: string | null
  status: ReportStatus
  reporterName: string | null
  assignedToName: string | null
  internalNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface ReportDetail {
  question: QuestionDetail
  reports: QuestionReportDetailItem[]
  qualitySignals: QualitySignal[]
  stats: QuestionAttemptStats
}

export interface ReviewerOption {
  id: string
  name: string
}

export interface ReportQueueCounts {
  open: number
  inReview: number
  resolved: number
  dismissed: number
  total: number
}

// CSV/import types now live in src/lib/import/types.ts (unified import pipeline).
