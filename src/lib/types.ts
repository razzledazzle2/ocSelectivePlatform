import type { LucideIcon } from 'lucide-react'

export const APP_ROLES = ['student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin'] as const
export const EXAM_TYPES = ['OC', 'Selective'] as const
export const QUESTION_STATUSES = ['draft', 'published', 'archived'] as const
export const QUESTION_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const
export const PRACTICE_MODES = ['practice'] as const
export const MISTAKE_STATUSES = ['needs_review', 'learning', 'improving', 'mastered'] as const
export const ADMIN_PORTAL_ROLES = ['tutor', 'admin', 'super_admin'] as const
export const STUDENT_PORTAL_ROLES = ['student', 'parent', 'external_customer'] as const

export type AppRole = (typeof APP_ROLES)[number]
export type ExamType = (typeof EXAM_TYPES)[number]
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]
export type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number]
export type PracticeMode = (typeof PRACTICE_MODES)[number]
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number]
export type AdminPortalRole = (typeof ADMIN_PORTAL_ROLES)[number]
export type StudentPortalRole = (typeof STUDENT_PORTAL_ROLES)[number]

export interface AppProfile {
  id: string
  email: string | null
  full_name: string | null
  role: AppRole
  year_level: number | null
  target_exam: string | null
  school: string | null
  avatar_url: string | null
  is_active: boolean
}

export type NavigationIconName =
  | 'gauge'
  | 'book-open'
  | 'revision'
  | 'clipboard-list'
  | 'users'

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
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string
  workedSolution: string
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
  yearLevel: number | null
  targetExam: string | null
  school: string | null
  createdAt: string
  questionsCompleted: number
  correctAnswers: number
  incorrectAnswers: number
  accuracy: number | null
  activeMistakes: number
  latestAttemptAt: string | null
}

export interface CsvRowError {
  field: string
  message: string
}

export interface CsvQuestionRowPreview {
  rowNumber: number
  examType: string
  yearLevel: string
  subjectSlug: string
  topicSlug: string
  questionTypeSlug: string
  difficulty: string
  questionText: string
  passageText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOptionLabel: string
  shortExplanation: string
  workedSolution: string
  status: string
  errors: CsvRowError[]
}

export interface CsvImportableQuestion {
  rowNumber: number
  examType: ExamType
  yearLevel: number | null
  subjectId: string
  subjectSlug: string
  topicId: string
  topicSlug: string
  questionTypeId: string | null
  questionTypeSlug: string
  difficulty: number
  questionText: string
  passageText: string | null
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
  status: Extract<QuestionStatus, 'draft' | 'published' | 'archived'>
}

export interface QuestionCsvPreviewResult {
  fileName: string
  totalRows: number
  validRows: CsvImportableQuestion[]
  previewRows: CsvQuestionRowPreview[]
}

export interface QuestionCsvImportSummary {
  importedCount: number
  skippedDuplicateCount: number
  importedQuestionIds: string[]
  rowMessages: Array<{
    rowNumber: number
    message: string
    status: 'imported' | 'skipped'
  }>
}
