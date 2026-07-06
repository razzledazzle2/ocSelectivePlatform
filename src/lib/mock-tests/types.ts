import type {
  ExamType,
  QuestionOptionLabel,
  QuestionOptionRecord,
  QuestionStatus,
} from '@/lib/types'
import type { MockSectionKey } from '@/lib/mock-exams/config'

export const MOCK_TEST_STATUSES = ['draft', 'published', 'archived'] as const
export type MockTestStatus = (typeof MOCK_TEST_STATUSES)[number]

/** Section vocabulary for curated mocks; 'custom' covers ad-hoc sections. */
export type MockTestSectionKey = MockSectionKey | 'custom'

export interface MockTestListItem {
  id: string
  title: string
  description: string | null
  examType: ExamType
  yearLevel: number | null
  status: MockTestStatus
  sectionCount: number
  questionCount: number
  /** Section time limits + scheduled breaks, in seconds. */
  estimatedDurationSeconds: number
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
  tags: string[]
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
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
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  sections: MockTestSectionItem[]
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
}
