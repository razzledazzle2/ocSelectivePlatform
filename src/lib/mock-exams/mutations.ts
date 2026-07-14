import { createClient } from '@/lib/supabase/server'
import { upsertMistakeQuestion } from '@/lib/practice/mutations'
import {
  MOCK_EXAM_CONFIGS,
  SECTIONED_MOCK_SECTIONS,
  resolveExamType,
  type MockExamType,
} from '@/lib/mock-exams/config'
import {
  fetchMockCandidates,
  selectMockExamQuestions,
  spreadAcrossTopics,
  type CandidateQuestion,
} from '@/lib/mock-exams/queries'
import type { ExamType, QuestionOptionLabel } from '@/lib/types'

interface CreateMockExamInput {
  studentId: string
  mockType: MockExamType
  chosenExamType: ExamType
  subjectId: string | null
}

interface CreateMockExamResult {
  sessionId: string
  totalQuestions: number
}

/**
 * Creates a mock exam session with a fixed, randomised question order. The timer starts now
 * (started_at defaults to now()), so this is only called when the student chooses to begin.
 * Returns null when no published questions are available for the configuration.
 */
export async function createMockExamSession(
  input: CreateMockExamInput
): Promise<CreateMockExamResult | null> {
  const config = MOCK_EXAM_CONFIGS[input.mockType]
  const examType = resolveExamType(config, input.chosenExamType)
  const subjectId = config.requiresSubject ? input.subjectId : null

  const selected = await selectMockExamQuestions(input.mockType, input.chosenExamType, subjectId)

  if (!selected.length) {
    return null
  }

  const supabase = await createClient()
  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .insert({
      student_id: input.studentId,
      mock_type: input.mockType,
      exam_type: examType,
      subject_id: subjectId,
      status: 'in_progress',
      time_limit_seconds: config.timeLimitSeconds,
      total_questions: selected.length,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error('Unable to start this mock exam.')
  }

  const rows = selected.map((question, index) => ({
    session_id: session.id,
    question_id: question.questionId,
    question_order: index + 1,
    is_flagged: false,
  }))

  const { error: questionsError } = await supabase
    .from('mock_exam_session_questions')
    .insert(rows)

  if (questionsError) {
    throw new Error('Unable to prepare the questions for this mock exam.')
  }

  return { sessionId: session.id, totalQuestions: selected.length }
}

/**
 * Creates a sectioned (randomised full) mock session: one row per section in
 * exam order, with randomised questions per MCQ section. Question selection
 * avoids questions the student attempted in the last 30 days where the bank
 * allows, and spreads across topics. The first section starts immediately.
 */
export async function createSectionedMockSession(input: {
  studentId: string
  chosenExamType: ExamType
}): Promise<CreateMockExamResult | null> {
  const supabase = await createClient()
  const examType = input.chosenExamType

  const subjectSlugs = SECTIONED_MOCK_SECTIONS.map((section) => section.subjectSlug).filter(Boolean)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [subjectsResult, recentAttemptsResult] = await Promise.all([
    supabase.from('subjects').select('id, slug').in('slug', subjectSlugs),
    supabase
      .from('question_attempts')
      .select('question_id')
      .eq('student_id', input.studentId)
      .gte('attempted_at', thirtyDaysAgo),
  ])

  if (subjectsResult.error) {
    throw new Error('Unable to prepare this mock exam.')
  }

  const subjectIdBySlug = new Map(
    (subjectsResult.data ?? []).map((subject) => [subject.slug, subject.id])
  )
  const recentQuestionIds = new Set(
    (recentAttemptsResult.data ?? []).map((row) => row.question_id)
  )

  const sectionSelections: Array<{
    config: (typeof SECTIONED_MOCK_SECTIONS)[number]
    questions: CandidateQuestion[]
  }> = []

  for (const section of SECTIONED_MOCK_SECTIONS) {
    if (section.questionCount === 0) {
      sectionSelections.push({ config: section, questions: [] })
      continue
    }

    const subjectId = subjectIdBySlug.get(section.subjectSlug)
    if (!subjectId) {
      sectionSelections.push({ config: section, questions: [] })
      continue
    }

    const candidates = await fetchMockCandidates(examType, subjectId)
    const fresh = candidates.filter((candidate) => !recentQuestionIds.has(candidate.id))
    const picked = spreadAcrossTopics(fresh, section.questionCount)

    if (picked.length < section.questionCount) {
      // Bank too small for a fully fresh set — top up with recently seen questions.
      const pickedIds = new Set(picked.map((question) => question.id))
      const seen = candidates.filter((candidate) => !pickedIds.has(candidate.id))
      picked.push(...spreadAcrossTopics(seen, section.questionCount - picked.length))
    }

    sectionSelections.push({ config: section, questions: picked })
  }

  const totalQuestions = sectionSelections.reduce(
    (sum, selection) => sum + selection.questions.length,
    0
  )

  if (totalQuestions === 0) {
    return null
  }

  const totalTimeLimit = SECTIONED_MOCK_SECTIONS.reduce(
    (sum, section) => sum + section.timeLimitSeconds,
    0
  )

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .insert({
      student_id: input.studentId,
      mock_type: 'randomised_full',
      exam_type: examType,
      subject_id: null,
      status: 'in_progress',
      time_limit_seconds: totalTimeLimit,
      total_questions: totalQuestions,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error('Unable to start this mock exam.')
  }

  const nowIso = new Date().toISOString()
  const sectionRows = sectionSelections.map((selection, index) => ({
    session_id: session.id,
    section_order: index + 1,
    section_key: selection.config.key,
    subject_id: subjectIdBySlug.get(selection.config.subjectSlug) ?? null,
    status: index === 0 ? 'in_progress' : 'pending',
    time_limit_seconds: selection.config.timeLimitSeconds,
    break_after_seconds: selection.config.breakAfterSeconds,
    started_at: index === 0 ? nowIso : null,
    total_questions: selection.questions.length,
  }))

  const { data: insertedSections, error: sectionsError } = await supabase
    .from('mock_exam_session_sections')
    .insert(sectionRows)
    .select('id, section_order')

  if (sectionsError || !insertedSections) {
    throw new Error('Unable to prepare the sections for this mock exam.')
  }

  const sectionIdByOrder = new Map(
    insertedSections.map((section) => [section.section_order, section.id])
  )

  const questionRows: Record<string, unknown>[] = []
  let questionOrder = 0
  sectionSelections.forEach((selection, index) => {
    for (const question of selection.questions) {
      questionOrder += 1
      questionRows.push({
        session_id: session.id,
        question_id: question.id,
        question_order: questionOrder,
        section_id: sectionIdByOrder.get(index + 1) ?? null,
        is_flagged: false,
      })
    }
  })

  if (questionRows.length) {
    const { error: questionsError } = await supabase
      .from('mock_exam_session_questions')
      .insert(questionRows)

    if (questionsError) {
      throw new Error('Unable to prepare the questions for this mock exam.')
    }
  }

  return { sessionId: session.id, totalQuestions }
}

export interface SubmitSectionResult {
  finished: boolean
  breakSeconds: number
  nextSectionOrder: number | null
}

/**
 * Submits one section of a sectioned mock. When it was the final open section,
 * the whole session is graded and finalised via submitMockExam.
 */
export async function submitMockSection(input: {
  sessionId: string
  studentId: string
  sectionId: string
  writingResponse?: string
  writingSubmittedForMarking?: boolean
}): Promise<SubmitSectionResult | null> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('mock_exam_sessions')
    .select('id, status')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (!session) {
    return null
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('mock_exam_session_sections')
    .select('id, section_order, status, break_after_seconds')
    .eq('session_id', input.sessionId)
    .order('section_order', { ascending: true })

  if (sectionsError || !sections?.length) {
    throw new Error('Unable to load the sections for this mock exam.')
  }

  const current = sections.find((section) => section.id === input.sectionId)
  if (!current) {
    throw new Error('This section could not be found.')
  }

  if (current.status === 'in_progress') {
    const update: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }
    if (input.writingResponse !== undefined) {
      update.writing_response = input.writingResponse
    }
    if (input.writingSubmittedForMarking !== undefined) {
      update.writing_submitted_for_marking = input.writingSubmittedForMarking
    }

    const { error: updateError } = await supabase
      .from('mock_exam_session_sections')
      .update(update)
      .eq('id', current.id)

    if (updateError) {
      throw new Error('Unable to submit this section.')
    }
  }

  const nextSection = sections.find(
    (section) => section.section_order > current.section_order && section.status === 'pending'
  )

  if (!nextSection) {
    // Last section done — grade and finalise the whole session.
    if (session.status === 'in_progress') {
      await submitMockExam(input.sessionId, input.studentId)
    }
    return { finished: true, breakSeconds: 0, nextSectionOrder: null }
  }

  return {
    finished: false,
    breakSeconds: current.break_after_seconds ?? 0,
    nextSectionOrder: nextSection.section_order,
  }
}

/** Starts the next pending section (used by "Skip break" and break expiry). */
export async function startNextMockSection(input: {
  sessionId: string
  studentId: string
}): Promise<{ sectionId: string } | null> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('mock_exam_sessions')
    .select('id, status')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (!session || session.status !== 'in_progress') {
    return null
  }

  const { data: sections } = await supabase
    .from('mock_exam_session_sections')
    .select('id, section_order, status')
    .eq('session_id', input.sessionId)
    .order('section_order', { ascending: true })

  const inProgress = (sections ?? []).find((section) => section.status === 'in_progress')
  if (inProgress) {
    return { sectionId: inProgress.id }
  }

  const next = (sections ?? []).find((section) => section.status === 'pending')
  if (!next) {
    return null
  }

  const { error } = await supabase
    .from('mock_exam_session_sections')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', next.id)
    .eq('status', 'pending')

  if (error) {
    throw new Error('Unable to start the next section.')
  }

  return { sectionId: next.id }
}

/** Autosaves the writing draft without submitting the section. */
export async function saveWritingDraft(input: {
  sessionId: string
  studentId: string
  sectionId: string
  writingResponse: string
}): Promise<void> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('mock_exam_sessions')
    .select('id, status')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (!session || session.status !== 'in_progress') {
    return
  }

  const { error } = await supabase
    .from('mock_exam_session_sections')
    .update({ writing_response: input.writingResponse })
    .eq('id', input.sectionId)
    .eq('session_id', input.sessionId)
    .eq('status', 'in_progress')

  if (error) {
    throw new Error('Unable to save your writing draft.')
  }
}

interface SaveMockAnswerInput {
  sessionId: string
  studentId: string
  questionId: string
  selectedOptionLabel?: QuestionOptionLabel | null
  isFlagged?: boolean
  timeSpentSeconds?: number
}

/**
 * Persists answer/flag state for one question as the student progresses, so a page refresh keeps
 * their work. Only touches sessions the student owns and that are still in progress.
 */
export async function saveMockAnswer(input: SaveMockAnswerInput): Promise<void> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .select('id, status')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (sessionError) {
    throw new Error('Unable to save your progress.')
  }

  if (!session || session.status !== 'in_progress') {
    // Nothing to update on a missing or already-submitted session.
    return
  }

  const update: Record<string, unknown> = {}

  if (input.selectedOptionLabel !== undefined) {
    update.selected_option_label = input.selectedOptionLabel
    update.answered_at = input.selectedOptionLabel ? new Date().toISOString() : null
    if (typeof input.timeSpentSeconds === 'number') {
      update.time_spent_seconds = Math.max(0, Math.round(input.timeSpentSeconds))
    }
  }

  if (input.isFlagged !== undefined) {
    update.is_flagged = input.isFlagged
  }

  if (!Object.keys(update).length) {
    return
  }

  const { error: updateError } = await supabase
    .from('mock_exam_session_questions')
    .update(update)
    .eq('session_id', input.sessionId)
    .eq('question_id', input.questionId)

  if (updateError) {
    throw new Error('Unable to save your progress.')
  }
}

interface SubmitMockExamResult {
  sessionId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  accuracy: number
}

/**
 * Grades and finalises a mock exam. Recomputes everything server-side from the saved answers
 * (never trusting client totals): writes answered questions into question_attempts (mode 'mock'),
 * routes every missed question into Smart Revision, and stores session totals. Idempotent — a
 * session that is not in progress is returned as-is.
 */
export async function submitMockExam(
  sessionId: string,
  studentId: string
): Promise<SubmitMockExamResult | null> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .select('id, status, started_at, time_limit_seconds')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (sessionError) {
    throw new Error('Unable to submit this mock exam.')
  }

  if (!session) {
    return null
  }

  if (session.status !== 'in_progress') {
    // Already finalised — return the stored totals so the caller can route to results.
    const { data: existing } = await supabase
      .from('mock_exam_sessions')
      .select('total_questions, correct_count, incorrect_count, unanswered_count, accuracy')
      .eq('id', sessionId)
      .maybeSingle()

    return {
      sessionId,
      totalQuestions: existing?.total_questions ?? 0,
      correctCount: existing?.correct_count ?? 0,
      incorrectCount: existing?.incorrect_count ?? 0,
      unansweredCount: existing?.unanswered_count ?? 0,
      accuracy: existing?.accuracy ?? 0,
    }
  }

  const { data: rows, error: rowsError } = await supabase
    .from('mock_exam_session_questions')
    .select(`
      question_id,
      selected_option_label,
      time_spent_seconds,
      question:questions(
        id,
        subject_id,
        topic_id,
        question_type_id,
        exam_type,
        difficulty,
        correct_option_label
      )
    `)
    .eq('session_id', sessionId)

  if (rowsError) {
    throw new Error('Unable to grade this mock exam.')
  }

  interface GradedRow {
    questionId: string
    selectedLabel: QuestionOptionLabel | null
    timeSpentSeconds: number | null
    subjectId: string
    topicId: string
    questionTypeId: string | null
    examType: ExamType
    difficulty: number
    correctLabel: QuestionOptionLabel
  }

  const graded: GradedRow[] = ((rows ?? []) as unknown as Array<{
    question_id: string
    selected_option_label: QuestionOptionLabel | null
    time_spent_seconds: number | null
    question: {
      id: string
      subject_id: string
      topic_id: string
      question_type_id: string | null
      exam_type: ExamType
      difficulty: number
      correct_option_label: QuestionOptionLabel | null
    } | null
  }>)
    // Rows without an answer key (e.g. a question converted to a writing
    // prompt after selection) cannot be graded — skip them gracefully.
    .filter((row) => row.question !== null && row.question.correct_option_label !== null)
    .map((row) => ({
      questionId: row.question_id,
      selectedLabel: row.selected_option_label,
      timeSpentSeconds: row.time_spent_seconds,
      subjectId: row.question!.subject_id,
      topicId: row.question!.topic_id,
      questionTypeId: row.question!.question_type_id,
      examType: row.question!.exam_type,
      difficulty: row.question!.difficulty,
      correctLabel: row.question!.correct_option_label as QuestionOptionLabel,
    }))

  let correctCount = 0
  let incorrectCount = 0
  let unansweredCount = 0

  const attemptRows: Record<string, unknown>[] = []

  for (const row of graded) {
    const isAnswered = row.selectedLabel !== null
    const isCorrect = isAnswered && row.selectedLabel === row.correctLabel

    if (!isAnswered) {
      unansweredCount += 1
    } else if (isCorrect) {
      correctCount += 1
    } else {
      incorrectCount += 1
    }

    // Only answered questions get a question_attempts row (selected_option_label is NOT NULL there).
    if (isAnswered) {
      attemptRows.push({
        session_id: null,
        student_id: studentId,
        question_id: row.questionId,
        selected_option_label: row.selectedLabel,
        correct_option_label: row.correctLabel,
        is_correct: isCorrect,
        time_taken_seconds: Math.max(0, Math.round(row.timeSpentSeconds ?? 0)),
        mode: 'mock',
        subject_id: row.subjectId,
        topic_id: row.topicId,
        question_type_id: row.questionTypeId,
        exam_type: row.examType,
        difficulty: row.difficulty,
      })
    }
  }

  if (attemptRows.length) {
    const { error: attemptError } = await supabase.from('question_attempts').insert(attemptRows)
    if (attemptError) {
      throw new Error('Unable to record your mock exam answers.')
    }
  }

  // Mistake tracking: every missed question (wrong OR unanswered) routes into Smart Revision;
  // correct answers still refresh any existing mistake record. Centralised via upsertMistakeQuestion.
  for (const row of graded) {
    const isAnswered = row.selectedLabel !== null
    const isCorrect = isAnswered && row.selectedLabel === row.correctLabel

    await upsertMistakeQuestion({
      studentId,
      questionId: row.questionId,
      subjectId: row.subjectId,
      topicId: row.topicId,
      questionTypeId: row.questionTypeId,
      examType: row.examType,
      difficulty: row.difficulty,
      answeredCorrectly: isCorrect,
    })
  }

  const totalQuestions = graded.length
  const accuracy =
    totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0

  const elapsedSeconds = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
  const totalTimeSeconds = Math.max(
    0,
    Math.min(elapsedSeconds, session.time_limit_seconds)
  )

  const { error: updateError } = await supabase
    .from('mock_exam_sessions')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      total_questions: totalQuestions,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unanswered_count: unansweredCount,
      accuracy,
      total_time_seconds: totalTimeSeconds,
    })
    .eq('id', sessionId)
    .eq('student_id', studentId)

  if (updateError) {
    throw new Error('Unable to finalise your mock exam results.')
  }

  return {
    sessionId,
    totalQuestions,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracy,
  }
}
