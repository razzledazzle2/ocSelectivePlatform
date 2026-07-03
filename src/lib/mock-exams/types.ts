import type { ExamType, QuestionOptionLabel, QuestionOptionRecord } from '@/lib/types'
import type { MockExamStatus, MockExamType } from '@/lib/mock-exams/config'

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

export interface MockExamResults {
  session: MockExamSummaryRow
  averageTimeSeconds: number
  flaggedCount: number
  subjectBreakdown: MockExamBreakdownRow[]
  topicBreakdown: MockExamBreakdownRow[]
  questionTypeBreakdown: MockExamBreakdownRow[]
  reviewQuestions: MockExamReviewQuestion[]
  recommendations: MockExamRecommendation[]
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
