import type { LucideIcon } from 'lucide-react'

export const APP_ROLES = ['student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin'] as const
export const EXAM_TYPES = ['OC', 'Selective'] as const
export const QUESTION_STATUSES = ['draft', 'reviewed', 'published', 'archived'] as const
// Content sign-off, independent of the publish lifecycle in QUESTION_STATUSES.
// Mirrors the CHECK constraint in migration 20260710042911.
//   unreviewed  → not yet checked by a human
//   validated   → content confirmed correct and usable
//   needs_fixes → reviewed and found wanting; do not treat as usable
export const VALIDATION_STATUSES = ['unreviewed', 'validated', 'needs_fixes'] as const
export const QUESTION_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
export const QUESTION_SOURCES = ['manual', 'csv', 'bulk_paste'] as const
export const PRACTICE_MODES = ['practice'] as const
export const ATTEMPT_MODES = ['practice', 'revision', 'mock'] as const
export const MISTAKE_STATUSES = ['needs_review', 'learning', 'improving', 'almost_mastered', 'mastered'] as const
export const PRACTICE_SET_MODES = ['new', 'mistakes', 'mixed'] as const
export const ADMIN_PORTAL_ROLES = ['tutor', 'admin', 'super_admin'] as const
export const STUDENT_PORTAL_ROLES = ['student', 'parent', 'external_customer'] as const

// -- Question bank v2: answer formats, stimuli, assets, rubrics ----------------

export const ANSWER_FORMATS = ['single_choice', 'extended_response'] as const
export const STIMULUS_TYPES = [
  'passage',
  'paired_extract',
  'poem',
  'information_text',
  'cloze_passage',
  'table',
  'chart',
  'logic_grid',
  'rule_box',
  'writing_context',
  'image_set',
] as const
export const STIMULUS_STATUSES = ['active', 'archived'] as const
export const ASSET_TYPES = ['image', 'diagram', 'svg', 'table', 'chart', 'audio'] as const
// pending   → placeholder from a CSV ref, no file yet
// generated → produced by the deterministic SVG pipeline, awaiting review
// uploaded  → a binary/external file is attached and usable
// approved  → reviewed and cleared for publishing
// rejected  → reviewed and sent back (do not publish)
// archived  → retired
export const ASSET_STATUSES = ['pending', 'generated', 'uploaded', 'approved', 'rejected', 'archived'] as const
/** Asset states that are safe to show to students / allow publishing. */
export const READY_ASSET_STATUSES = ['generated', 'uploaded', 'approved'] as const
export const WRITING_TEXT_TYPES = [
  'narrative',
  'persuasive',
  'informative',
  'discursive',
  'report',
  'advice_sheet',
  'speech',
  'letter',
  'diary',
  'recount',
  'description',
  'hybrid',
] as const

export type AnswerFormat = (typeof ANSWER_FORMATS)[number]
export type StimulusType = (typeof STIMULUS_TYPES)[number]
export type StimulusStatus = (typeof STIMULUS_STATUSES)[number]
export type AssetType = (typeof ASSET_TYPES)[number]
export type AssetStatus = (typeof ASSET_STATUSES)[number]
export type WritingTextType = (typeof WRITING_TEXT_TYPES)[number]

export const ANSWER_FORMAT_LABELS: Record<AnswerFormat, string> = {
  single_choice: 'Multiple choice',
  extended_response: 'Extended response',
}

export interface StimulusRecord {
  id: string
  external_ref: string | null
  title: string
  stimulus_type: StimulusType
  body_markdown: string | null
  source_info: Record<string, unknown>
  status: StimulusStatus
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface AssetRecord {
  id: string
  external_ref: string | null
  asset_type: AssetType
  storage_path: string | null
  external_url: string | null
  alt_text: string | null
  generation_prompt: string | null
  license_notes: string | null
  metadata: Record<string, unknown>
  /** Structured spec (coordinate_grid, bar_chart, …) the SVG can be regenerated from. */
  spec: Record<string, unknown> | null
  status: AssetStatus
  created_at?: string
  updated_at?: string
}

export interface QuestionVariantRecord {
  id: string
  question_type_id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

/** A question ↔ asset link with its display role. */
export interface QuestionAssetLink {
  id: string
  role: 'question' | 'solution'
  sort_order: number
  asset: AssetRecord
}

/** A stimulus ↔ asset link (display order only; no roles). */
export interface StimulusAssetLink {
  id: string
  sort_order: number
  asset: AssetRecord
}

/** A stimulus hydrated with its linked assets (sorted). */
export interface StimulusDetail extends StimulusRecord {
  assets: StimulusAssetLink[]
}

export interface RubricCriterion {
  name: string
  description?: string
  maxMarks: number
}

export interface RubricScoreBand {
  band: string
  range?: string
  descriptor?: string
}

/** Marking rubric stored on extended_response (writing prompt) questions. */
export interface WritingRubric {
  textType?: WritingTextType | string
  criteria: RubricCriterion[]
  scoreBands?: RubricScoreBand[]
  sampleAnswerNotes?: string
  planningHints?: string[]
}

/** Optional presentation hints carried from import (input_method, display_mode). */
export interface QuestionPresentation {
  inputMethod?: string
  displayMode?: string
  answerValidation?: Record<string, unknown>
}

/** Provenance of imported/authored questions. */
export interface QuestionSourceInfo {
  sourceName?: string
  sourcePaper?: string
  sourceSection?: string
  sourceQuestionNumber?: string
  licenseNotes?: string
}

/** Lightweight asset shape hydrated into student-facing question payloads. */
export interface StudentAssetRef {
  id: string
  assetType: AssetType
  /** Raw CSV/import reference (e.g. asset://question-assets/...); lets the renderer resolve public assets. */
  externalRef: string | null
  storagePath: string | null
  externalUrl: string | null
  altText: string | null
  status: AssetStatus
}

/** Lightweight stimulus shape hydrated into student-facing question payloads. */
export interface StudentStimulus {
  id: string
  title: string
  stimulusType: StimulusType
  bodyMarkdown: string | null
  assets: StudentAssetRef[]
}

export type AppRole = (typeof APP_ROLES)[number]
export type ExamType = (typeof EXAM_TYPES)[number]
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]
export type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number]
export type QuestionSource = (typeof QUESTION_SOURCES)[number]
export type PracticeMode = (typeof PRACTICE_MODES)[number]
export type AttemptMode = (typeof ATTEMPT_MODES)[number]
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number]
export type PracticeSetMode = (typeof PRACTICE_SET_MODES)[number]

/** Student-facing labels for spaced-repetition stages. */
export const MISTAKE_STATUS_LABELS: Record<MistakeStatus, string> = {
  needs_review: 'Needs review',
  learning: 'Learning',
  improving: 'Improving',
  almost_mastered: 'Almost mastered',
  mastered: 'Mastered',
}

/** Minimum attempts before option response distributions are shown to students. */
export const OPTION_STATS_MIN_ATTEMPTS = 5

/** Aggregated option response distribution for one question (post-answer only). */
export interface OptionStats {
  totalAttempts: number
  counts: Partial<Record<QuestionOptionLabel, number>>
}
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
  | 'layers'
  | 'chart'
  | 'upload'

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
  asset_id?: string | null
  explanation?: string | null
  /** Hydrated when the option is visual (image/SVG answer choices). */
  asset?: StudentAssetRef | null
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
  /** @deprecated Retired from the active content model. Read-only fallback that
   * feeds the authoritative worked_solution; never authored, exported or shown. */
  short_explanation: string | null
  worked_solution: string | null
  correct_option_label: QuestionOptionLabel | null
  status: QuestionStatus
  /** Content sign-off, independent of the publish lifecycle in `status`. */
  validation_status: ValidationStatus
  validated_at: string | null
  validated_by: string | null
  source: QuestionSource
  tags: string[]
  answer_format: AnswerFormat
  marks: number
  time_limit_seconds: number | null
  external_id: string | null
  stimulus_id: string | null
  variant_id: string | null
  skill_tags: string[]
  concept_tags: string[]
  // -- Canonical taxonomy v1 (codes from src/lib/taxonomy) --------------------
  // The subject reuses the existing subject_id FK; domain/subtopic/skill and the
  // separate metadata dimensions are stored as stable string codes (nullable,
  // editable, no DB enum). See docs/question-taxonomy-v1.md.
  domain_code: string | null
  subtopic_code: string | null
  skill_code: string | null
  pattern_key: string | null
  question_family: string | null
  /** Per-question stimulus type (canonical STIMULUS_FORMATS), distinct from the shared stimuli.stimulus_type. */
  stimulus_format: string | null
  stimulus_genre: string | null
  asset_render_method: string | null
  writing_form: string | null
  writing_purpose: string | null
  writing_prompt_stimulus: string | null
  rubric: WritingRubric | null
  presentation: QuestionPresentation
  source_info: QuestionSourceInfo
  created_by: string | null
  updated_by: string | null
  published_at: string | null
  archived_at: string | null
  /** Soft-delete (trash) stamp; null unless the question is in the trash. */
  deleted_at: string | null
  deleted_by: string | null
  delete_reason: string | null
  created_at: string
  updated_at: string
}

export interface QuestionDetail extends QuestionRecord {
  subject: SubjectRecord
  topic: TopicRecord
  questionType: QuestionTypeRecord | null
  options: QuestionOptionRecord[]
  stimulus: StimulusDetail | null
  assets: QuestionAssetLink[]
}

export const ADMIN_QUESTION_PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_ADMIN_QUESTION_PAGE_SIZE = 25

export const ADMIN_QUESTION_SORTS = [
  'updated_desc',
  'updated_asc',
  'created_desc',
  'created_asc',
  'difficulty_desc',
  'difficulty_asc',
  'accuracy_asc',
  'accuracy_desc',
  'attempts_desc',
] as const
export type AdminQuestionSort = (typeof ADMIN_QUESTION_SORTS)[number]

export const ADMIN_QUESTION_SORT_LABELS: Record<AdminQuestionSort, string> = {
  updated_desc: 'Updated (newest)',
  updated_asc: 'Updated (oldest)',
  created_desc: 'Created (newest)',
  created_asc: 'Created (oldest)',
  difficulty_desc: 'Difficulty (high → low)',
  difficulty_asc: 'Difficulty (low → high)',
  accuracy_asc: 'Wrong % (highest first)',
  accuracy_desc: 'Correct % (highest first)',
  attempts_desc: 'Most attempted',
}

export interface AdminQuestionFilters {
  examType?: string
  subjectId?: string
  topicId?: string
  questionTypeId?: string
  /** Canonical taxonomy filters (codes from src/lib/taxonomy). */
  domainCode?: string
  subtopicCode?: string
  skillCode?: string
  questionFamily?: string
  stimulusFormat?: string
  patternKey?: string
  tag?: string
  difficulty?: string
  status?: string
  /** Content sign-off filter (VALIDATION_STATUSES): 'unreviewed' | 'validated' | 'needs_fixes'. */
  validationStatus?: string
  answerFormat?: string
  /** Asset readiness filter: 'has' | 'pending' | 'missing' | 'approved'. */
  assetState?: string
  query?: string
  sort?: string
  page?: string
  pageSize?: string
}

/**
 * Aggregated, real attempt data for one question shown in the admin bank.
 * Built only from rows that exist in question_attempts — never fabricated.
 */
export interface AdminQuestionStats {
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  /** 0–1; null when there are no attempts. */
  accuracy: number | null
  /** null when there are no attempts. */
  averageTimeSeconds: number | null
  lastAttemptedAt: string | null
  /** Distribution of ALL selected answers (correct and wrong). */
  optionCounts: Partial<Record<QuestionOptionLabel, number>>
  /** Total reports (any status) filed against this question. */
  reportCount: number
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
  answerFormat: AnswerFormat
  hasStimulus: boolean
  hasAssets: boolean
  /** Readiness of linked assets: 'none' (no assets), 'pending' (needs work), 'ready'. */
  assetState: 'none' | 'pending' | 'ready'
  optionsCount: number
  correctOptionLabel: QuestionOptionLabel | null
  tags: string[]
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  archivedAt: string | null
  /** Soft-delete (trash) stamp; null unless the question is in the trash. */
  deletedAt: string | null
  /** Attached for the visible page only; null until stats are hydrated. */
  stats: AdminQuestionStats | null
}

export interface AdminQuestionsPage {
  items: AdminQuestionListItem[]
  totalCount: number
  /** 1-based, already clamped to the last available page. */
  page: number
  pageSize: number
  pageCount: number
}

/** Statuses settable from the question form (archiving has its own action). */
export type EditableQuestionStatus = Exclude<QuestionStatus, 'archived'>

export interface QuestionFormValues {
  examType: ExamType
  subjectId: string
  topicId: string
  questionTypeId: string
  // Canonical taxonomy v1 (stable codes; '' = not set).
  domainCode: string
  subtopicCode: string
  skillCode: string
  patternKey: string
  questionFamily: string
  stimulusFormat: string
  stimulusGenre: string
  assetRenderMethod: string
  writingForm: string
  writingPurpose: string
  writingPromptStimulus: string
  yearLevel: string
  difficulty: string
  answerFormat: AnswerFormat
  marks: string
  timeLimitSeconds: string
  questionText: string
  passageText: string
  /** '' = no linked stimulus. */
  stimulusId: string
  /** Option texts in label order (index 0 = A, 1 = B, ...). Length 4–5. */
  options: string[]
  correctOptionLabel: QuestionOptionLabel
  workedSolution: string
  /** Comma-separated in the form; split into text[] on write. */
  tags: string
  skillTags: string
  conceptTags: string
  /** Raw JSON in the form; parsed/validated into WritingRubric on write. */
  rubricJson: string
  status: EditableQuestionStatus
}

export interface QuestionWriteInput {
  examType: ExamType
  subjectId: string
  topicId: string
  questionTypeId: string | null
  // Canonical taxonomy v1 (stable codes; null = not set).
  domainCode: string | null
  subtopicCode: string | null
  skillCode: string | null
  patternKey: string | null
  questionFamily: string | null
  stimulusFormat: string | null
  stimulusGenre: string | null
  assetRenderMethod: string | null
  writingForm: string | null
  writingPurpose: string | null
  writingPromptStimulus: string | null
  yearLevel: number | null
  difficulty: number
  answerFormat: AnswerFormat
  marks: number
  timeLimitSeconds: number | null
  questionText: string
  passageText: string | null
  stimulusId: string | null
  options: QuestionOptionRecord[]
  correctOptionLabel: QuestionOptionLabel | null
  workedSolution: string | null
  tags: string[]
  skillTags: string[]
  conceptTags: string[]
  rubric: WritingRubric | null
  externalId?: string | null
  variantId?: string | null
  presentation?: QuestionPresentation
  sourceInfo?: QuestionSourceInfo
  status: EditableQuestionStatus
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
  answerFormat: AnswerFormat
  questionText: string
  passageText: string | null
  stimulus: StudentStimulus | null
  questionAssets: StudentAssetRef[]
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
  /** Aggregated distribution across all students; null when unavailable. */
  optionStats: OptionStats | null
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
  | 'almost_mastered'
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
  /** Aggregated distribution across all students; null when unavailable. */
  optionStats: OptionStats | null
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
  stimulus: StudentStimulus | null
  questionAssets: StudentAssetRef[]
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
