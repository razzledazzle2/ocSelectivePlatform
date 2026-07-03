import type { ExamType } from '@/lib/types'

export const MOCK_EXAM_TYPES = ['mini', 'subject', 'full_selective', 'full_oc', 'randomised_full'] as const
export type MockExamType = (typeof MOCK_EXAM_TYPES)[number]

export const MOCK_EXAM_STATUSES = ['in_progress', 'submitted', 'expired'] as const
export type MockExamStatus = (typeof MOCK_EXAM_STATUSES)[number]

export interface MockExamTypeConfig {
  type: MockExamType
  name: string
  tagline: string
  description: string
  /** Target number of questions. Fewer may be used when the bank is short. */
  questionCount: number
  timeLimitSeconds: number
  /** Fixed exam type, or null when the student chooses OC vs Selective. */
  fixedExamType: ExamType | null
  /** Whether the student must pick a subject before starting. */
  requiresSubject: boolean
}

export const MOCK_EXAM_CONFIGS: Record<MockExamType, MockExamTypeConfig> = {
  mini: {
    type: 'mini',
    name: 'Mini Mock Exam',
    tagline: 'Quick warm-up',
    description: 'A short, mixed set across subjects to rehearse working under the clock.',
    questionCount: 10,
    timeLimitSeconds: 15 * 60,
    fixedExamType: null,
    requiresSubject: false,
  },
  subject: {
    type: 'subject',
    name: 'Subject Mock Exam',
    tagline: 'Focus one subject',
    description: 'Concentrate on a single subject with a longer timed set.',
    questionCount: 20,
    timeLimitSeconds: 30 * 60,
    fixedExamType: null,
    requiresSubject: true,
  },
  full_selective: {
    type: 'full_selective',
    name: 'Full Selective Mock',
    tagline: 'Selective test rehearsal',
    description: 'A broad Selective set drawn across every subject in the bank.',
    questionCount: 40,
    timeLimitSeconds: 60 * 60,
    fixedExamType: 'Selective',
    requiresSubject: false,
  },
  full_oc: {
    type: 'full_oc',
    name: 'Full OC Mock',
    tagline: 'OC test rehearsal',
    description: 'A broad OC set drawn across every subject in the bank.',
    questionCount: 30,
    timeLimitSeconds: 45 * 60,
    fixedExamType: 'OC',
    requiresSubject: false,
  },
  randomised_full: {
    type: 'randomised_full',
    name: 'Randomised Full Mock',
    tagline: 'The full exam experience',
    description:
      'Four timed sections in real exam order — Reading, Mathematical Reasoning, Thinking Skills and Writing — with scheduled breaks you can skip.',
    questionCount: 45,
    timeLimitSeconds: 85 * 60,
    fixedExamType: null,
    requiresSubject: false,
  },
}

// -- Sectioned (randomised full) mock structure -------------------------------

export const MOCK_SECTION_KEYS = [
  'reading',
  'mathematical_reasoning',
  'thinking_skills',
  'writing',
] as const
export type MockSectionKey = (typeof MOCK_SECTION_KEYS)[number]

export interface MockExamSectionConfig {
  key: MockSectionKey
  name: string
  /** subjects.slug this section draws questions from ('' for writing). */
  subjectSlug: string
  /** Target question count; fewer are used when the bank is short. 0 = free response. */
  questionCount: number
  timeLimitSeconds: number
  /** Scheduled break AFTER this section; 0 = no break (last section). */
  breakAfterSeconds: number
}

/**
 * Section order and breaks for the randomised full mock:
 * Reading -> 5 min break -> Mathematical Reasoning -> 10 min break ->
 * Thinking Skills -> 5 min break -> Writing.
 */
export const SECTIONED_MOCK_SECTIONS: MockExamSectionConfig[] = [
  {
    key: 'reading',
    name: 'Reading',
    subjectSlug: 'reading',
    questionCount: 15,
    timeLimitSeconds: 20 * 60,
    breakAfterSeconds: 5 * 60,
  },
  {
    key: 'mathematical_reasoning',
    name: 'Mathematical Reasoning',
    subjectSlug: 'mathematical-reasoning',
    questionCount: 15,
    timeLimitSeconds: 20 * 60,
    breakAfterSeconds: 10 * 60,
  },
  {
    key: 'thinking_skills',
    name: 'Thinking Skills',
    subjectSlug: 'thinking-skills',
    questionCount: 15,
    timeLimitSeconds: 20 * 60,
    breakAfterSeconds: 5 * 60,
  },
  {
    key: 'writing',
    name: 'Writing',
    subjectSlug: 'writing',
    questionCount: 0,
    timeLimitSeconds: 25 * 60,
    breakAfterSeconds: 0,
  },
]

export function getSectionConfig(key: string): MockExamSectionConfig | null {
  return SECTIONED_MOCK_SECTIONS.find((section) => section.key === key) ?? null
}

export const MOCK_EXAM_CONFIG_LIST: MockExamTypeConfig[] = MOCK_EXAM_TYPES.map(
  (type) => MOCK_EXAM_CONFIGS[type]
)

export function isMockExamType(value: string): value is MockExamType {
  return (MOCK_EXAM_TYPES as readonly string[]).includes(value)
}

/**
 * Resolves the exam type a mock session should use given its config and the student's choice.
 * Full mocks pin their exam type; mini/subject respect the selected exam type.
 */
export function resolveExamType(config: MockExamTypeConfig, chosen: ExamType): ExamType {
  return config.fixedExamType ?? chosen
}

/** Warn the student when this many seconds or fewer remain. */
export const MOCK_EXAM_LOW_TIME_SECONDS = 5 * 60
