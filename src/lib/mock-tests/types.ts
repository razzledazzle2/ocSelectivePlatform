import type {
  AnswerFormat,
  ExamType,
  QuestionOptionLabel,
  QuestionOptionRecord,
  QuestionStatus,
} from '@/lib/types'
import type { MockSectionKey } from '@/lib/mock-exams/config'

export const MOCK_TEST_STATUSES = ['draft', 'published', 'archived'] as const
export type MockTestStatus = (typeof MOCK_TEST_STATUSES)[number]

/** Purpose of a curated mock — drives the student badge and coverage intent. */
export const MOCK_TYPES = [
  'diagnostic',
  'full_mock',
  'topic_focus',
  'speed_practice',
  'challenge',
] as const
export type MockType = (typeof MOCK_TYPES)[number]

export const MOCK_TYPE_LABELS: Record<MockType, string> = {
  diagnostic: 'Balanced diagnostic',
  full_mock: 'Full selective-style',
  topic_focus: 'Topic focus',
  speed_practice: 'Speed practice',
  challenge: 'Challenge',
}

export const MOCK_TYPE_DESCRIPTIONS: Record<MockType, string> = {
  diagnostic: 'A balanced spread across every section to reveal strengths and gaps.',
  full_mock: 'A complete selective-style paper across all sections under exam timing.',
  topic_focus: 'Concentrated practice on one topic or skill area.',
  speed_practice: 'Shorter, timed drills to build accuracy under pressure.',
  challenge: 'Harder questions to stretch strong students.',
}

/** Section vocabulary for curated mocks; 'custom' covers ad-hoc sections. */
export type MockTestSectionKey = MockSectionKey | 'custom'

/** One subject's share of a mock's questions, for the admin "subject mix" column. */
export interface MockSubjectShare {
  subjectName: string
  count: number
}

export interface MockTestListItem {
  id: string
  title: string
  description: string | null
  examType: ExamType
  yearLevel: number | null
  status: MockTestStatus
  mockType: MockType
  difficultyLabel: string | null
  displayOrder: number
  sectionCount: number
  questionCount: number
  /** Section time limits + scheduled breaks, in seconds. */
  estimatedDurationSeconds: number
  /** Ordered subject breakdown (largest first) for the list "subject mix". */
  subjectMix: MockSubjectShare[]
  /** Submitted student sessions of this mock; 0 until the runner links sessions. */
  attemptsCount: number
  /** Mean accuracy (0–100) across submitted sessions; null without attempts. */
  averageAccuracy: number | null
  updatedAt: string
  createdAt: string
}

export interface MockTestQuestionItem {
  /** mock_test_questions row id (used for remove/reorder). */
  id: string
  questionId: string
  questionOrder: number
  marks: number
  questionText: string
  passageText: string | null
  difficulty: number
  questionStatus: QuestionStatus
  subjectName: string
  topicName: string
  questionTypeName: string | null
  answerFormat: AnswerFormat
  tags: string[]
  skillTags: string[]
  conceptTags: string[]
  /** Sub-variant under the essential question type; groups a "question family". */
  variantId: string | null
  /** Shared stimulus id; also groups a family of questions off one passage. */
  stimulusId: string | null
  hasAssets: boolean
  /** Soft-delete stamp on the underlying bank question; blocks publishing. */
  deletedAt: string | null
  correctOptionLabel: QuestionOptionLabel | null
  shortExplanation: string | null
  workedSolution: string | null
  options: QuestionOptionRecord[]
}

export interface MockTestSectionItem {
  id: string
  sectionOrder: number
  sectionKey: MockTestSectionKey
  name: string
  subjectId: string | null
  subjectName: string | null
  timeLimitSeconds: number
  breakAfterSeconds: number
  questions: MockTestQuestionItem[]
}

export interface MockTestDetail {
  id: string
  title: string
  description: string | null
  examType: ExamType
  yearLevel: number | null
  status: MockTestStatus
  mockType: MockType
  instructions: string | null
  difficultyLabel: string | null
  displayOrder: number
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  sections: MockTestSectionItem[]
}

/** A published curated mock as it appears in the student list, with the student's own progress. */
export interface StudentMockListItem {
  id: string
  title: string
  description: string | null
  examType: ExamType
  yearLevel: number | null
  mockType: MockType
  difficultyLabel: string | null
  questionCount: number
  estimatedDurationSeconds: number
  subjectMix: MockSubjectShare[]
  attemptStatus: 'not_started' | 'in_progress' | 'completed'
  /** Latest session id to continue or review; null when not yet started. */
  sessionId: string | null
  /** Accuracy 0–100 for the completed attempt; null otherwise. */
  score: number | null
  completedAt: string | null
}

/** Aggregates over submitted student sessions of one curated mock. */
export interface MockTestAttemptStats {
  attemptsCount: number
  /** Mean accuracy 0–100. */
  averageAccuracy: number | null
  averageTimeSeconds: number | null
  /** questionId -> { attempts, correct } across submitted sessions. */
  perQuestion: Record<string, { attempts: number; correct: number }>
}

export interface MockTestMetaInput {
  title: string
  description: string | null
  examType: ExamType
  yearLevel: number | null
  mockType: MockType
  instructions: string | null
  difficultyLabel: string | null
}

// -- Coverage -----------------------------------------------------------------

/** One row of a coverage distribution (subject, topic, difficulty, …). */
export interface CoverageBucket {
  key: string
  label: string
  count: number
}

export type CoverageWarningTone = 'critical' | 'warning' | 'info'

export interface CoverageWarning {
  tone: CoverageWarningTone
  message: string
}

/** Full coverage report for one curated mock, computed from question metadata. */
export interface MockCoverage {
  totalQuestions: number
  totalMarks: number
  bySubject: CoverageBucket[]
  byTopic: CoverageBucket[]
  byQuestionType: CoverageBucket[]
  byDifficulty: CoverageBucket[]
  byAnswerFormat: CoverageBucket[]
  bySkillTag: CoverageBucket[]
  assetCount: number
  stimulusCount: number
  writingCount: number
  warnings: CoverageWarning[]
}

// -- Across-all-mocks program coverage ----------------------------------------

export interface TopicUsage {
  topicId: string
  topicName: string
  subjectName: string
  mockCount: number
  questionCount: number
}

/** Coverage across every published curated mock (the admin program dashboard). */
export interface MockProgramCoverage {
  publishedMockCount: number
  totalQuestionSlots: number
  distinctQuestionsUsed: number
  bySubject: CoverageBucket[]
  byDifficulty: CoverageBucket[]
  byMockType: CoverageBucket[]
  topicUsage: TopicUsage[]
  neverUsedTopics: Array<{ topicId: string; topicName: string; subjectName: string }>
  overusedTopics: TopicUsage[]
}
