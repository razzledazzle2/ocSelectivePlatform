import type {
  ExamType,
  QuestionOptionLabel,
  QuestionOptionRecord,
  StudentAssetRef,
  StudentStimulus,
} from '@/lib/types'
import type { MockExamStatus, MockExamType, MockSectionKey } from '@/lib/mock-exams/config'

export const MOCK_SECTION_STATUSES = ['pending', 'in_progress', 'submitted', 'skipped'] as const
export type MockSectionStatus = (typeof MOCK_SECTION_STATUSES)[number]

/** One section of a sectioned (randomised full) mock session. */
export interface MockExamSectionRow {
  id: string
  sectionOrder: number
  sectionKey: MockSectionKey
  name: string
  status: MockSectionStatus
  timeLimitSeconds: number
  breakAfterSeconds: number
  startedAt: string | null
  submittedAt: string | null
  writingResponse: string | null
  writingSubmittedForMarking: boolean
  questionCount: number
}

/** Everything the sectioned mock runner needs to render and resume. */
export interface SectionedMockRunnerData {
  sessionId: string
  mockName: string
  examType: ExamType
  status: MockExamStatus
  sections: MockExamSectionRow[]
  /** All MCQ questions in the session, tagged with their section id. */
  questions: Array<MockExamRunnerQuestion & { sectionId: string | null }>
}

/** A single question inside a running mock exam — never carries the correct answer. */
export interface MockExamRunnerQuestion {
  id: string
  questionOrder: number
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
  /** Linked shared stimulus (preferred over passageText when present). */
  stimulus: StudentStimulus | null
  /** Pre-answer question-level assets (role 'question'). */
  questionAssets: StudentAssetRef[]
  options: QuestionOptionRecord[]
  selectedOptionLabel: QuestionOptionLabel | null
  isFlagged: boolean
}

/** Everything the client runner needs to render and resume a mock exam. */
export interface MockExamRunnerData {
  sessionId: string
  mockType: MockExamType
  mockName: string
  examType: ExamType
  subjectName: string | null
  status: MockExamStatus
  timeLimitSeconds: number
  startedAt: string
  /** Server-computed deadline in epoch milliseconds, robust across refreshes. */
  deadlineMs: number
  questions: MockExamRunnerQuestion[]
}

export interface MockExamSummaryRow {
  id: string
  mockType: MockExamType
  mockName: string
  examType: ExamType
  subjectName: string | null
  status: MockExamStatus
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  accuracy: number | null
  totalTimeSeconds: number
  startedAt: string
  submittedAt: string | null
  createdAt: string
}

/** One reviewed question on the results page, with the correct answer revealed post-submission. */
export interface MockExamReviewQuestion {
  questionId: string
  questionOrder: number
  timeSpentSeconds: number | null
  subjectName: string
  topicName: string
  questionTypeName: string | null
  difficulty: number
  questionText: string
  passageText: string | null
  options: QuestionOptionRecord[]
  selectedOptionLabel: QuestionOptionLabel | null
  correctOptionLabel: QuestionOptionLabel
  isCorrect: boolean
  isAnswered: boolean
  isFlagged: boolean
  shortExplanation: string | null
  workedSolution: string
}

export interface MockExamBreakdownRow {
  label: string
  total: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number
}

export interface MockExamRecommendation {
  id: string
  title: string
  description: string
  href: string
  ctaLabel: string
}

/** Cross-student comparison for one submitted mock (from a security-definer aggregate). */
export interface MockExamComparison {
  participantCount: number
  averageAccuracy: number
  rank: number
}

/** Minimum distinct students before comparison data is shown. */
export const MOCK_COMPARISON_MIN_PARTICIPANTS = 5

export interface MockExamResults {
  session: MockExamSummaryRow
  averageTimeSeconds: number
  flaggedCount: number
  subjectBreakdown: MockExamBreakdownRow[]
  topicBreakdown: MockExamBreakdownRow[]
  questionTypeBreakdown: MockExamBreakdownRow[]
  reviewQuestions: MockExamReviewQuestion[]
  recommendations: MockExamRecommendation[]
  /** Null until enough students have completed this mock. */
  comparison: MockExamComparison | null
  /** Writing section state for sectioned mocks; null for single-section mocks. */
  writingSection: {
    submittedForMarking: boolean
    response: string | null
  } | null
}

export interface PrepareMockExamResult {
  mockType: MockExamType
  mockName: string
  examType: ExamType
  subjectId: string | null
  subjectName: string | null
  targetQuestionCount: number
  availableQuestionCount: number
  timeLimitSeconds: number
}
