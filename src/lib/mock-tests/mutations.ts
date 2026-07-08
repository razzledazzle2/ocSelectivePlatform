import { SECTIONED_MOCK_SECTIONS } from '@/lib/mock-exams/config'
import { createClient } from '@/lib/supabase/server'
import type { MockTestMetaInput, MockTestStatus, MockType } from '@/lib/mock-tests/types'

/**
 * Creates a mock test with the full exam section template:
 * Reading -> 5 min break -> Mathematical Reasoning -> 10 min break ->
 * Thinking Skills -> 5 min break -> Writing. Sections whose subject exists in
 * the taxonomy are linked to it (by slug) so the question picker can pre-filter.
 */
export async function createMockTest(input: MockTestMetaInput, userId: string): Promise<string> {
  const supabase = await createClient()
  const { data: test, error } = await supabase
    .from('mock_tests')
    .insert({
      title: input.title,
      description: input.description,
      exam_type: input.examType,
      year_level: input.yearLevel,
      mock_type: input.mockType,
      instructions: input.instructions,
      difficulty_label: input.difficultyLabel,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error || !test) {
    throw new Error('Unable to create the mock test.')
  }

  const { data: subjects } = await supabase.from('subjects').select('id, slug')
  const subjectIdBySlug = new Map(
    ((subjects ?? []) as Array<{ id: string; slug: string }>).map((subject) => [subject.slug, subject.id])
  )

  const sectionRows = SECTIONED_MOCK_SECTIONS.map((section, index) => ({
    mock_test_id: test.id,
    section_order: index + 1,
    section_key: section.key,
    name: section.name,
    subject_id: subjectIdBySlug.get(section.subjectSlug) ?? null,
    time_limit_seconds: section.timeLimitSeconds,
    break_after_seconds: section.breakAfterSeconds,
  }))

  const { error: sectionsError } = await supabase.from('mock_test_sections').insert(sectionRows)

  if (sectionsError) {
    throw new Error('The mock was created but its sections could not be set up.')
  }

  return test.id
}

export async function updateMockTestMeta(id: string, input: MockTestMetaInput, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mock_tests')
    .update({
      title: input.title,
      description: input.description,
      exam_type: input.examType,
      year_level: input.yearLevel,
      mock_type: input.mockType,
      instructions: input.instructions,
      difficulty_label: input.difficultyLabel,
      updated_by: userId,
    })
    .eq('id', id)

  if (error) {
    throw new Error('Unable to update the mock test details.')
  }
}

/** Sets the student-list ordering position (lower shows first). */
export async function updateMockDisplayOrder(id: string, displayOrder: number, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mock_tests')
    .update({ display_order: displayOrder, updated_by: userId })
    .eq('id', id)

  if (error) {
    throw new Error('Unable to update the mock order.')
  }
}

/**
 * Blocks publishing a mock that students could not actually sit: no questions,
 * or questions they cannot read (deleted, archived, or not yet published — the
 * question RLS hides all of those from students). Throws with a single, clear
 * message listing every blocker. Warnings (coverage imbalance etc.) never block.
 */
export async function assertMockReadyForPublish(mockTestId: string): Promise<void> {
  const supabase = await createClient()

  const { data: header, error: headerError } = await supabase
    .from('mock_tests')
    .select('title')
    .eq('id', mockTestId)
    .maybeSingle()

  if (headerError) {
    throw new Error('Unable to check the mock before publishing.')
  }

  const { data: rows, error } = await supabase
    .from('mock_test_questions')
    .select('question:questions(status, deleted_at)')
    .eq('mock_test_id', mockTestId)

  if (error) {
    throw new Error('Unable to check the mock questions before publishing.')
  }

  const questions = (rows ?? []).map((row) => {
    const relation = (row as { question: { status: string; deleted_at: string | null }[] | { status: string; deleted_at: string | null } | null }).question
    return Array.isArray(relation) ? relation[0] ?? null : relation
  })

  const problems: string[] = []

  if (!header?.title?.trim()) {
    problems.push('it needs a title')
  }
  if (questions.length === 0) {
    problems.push('it has no questions')
  }

  const deleted = questions.filter((question) => question?.deleted_at).length
  if (deleted > 0) {
    problems.push(`${deleted} question${deleted === 1 ? ' has' : 's have'} been deleted from the bank`)
  }

  const archived = questions.filter((question) => question?.status === 'archived').length
  if (archived > 0) {
    problems.push(`${archived} question${archived === 1 ? ' is' : 's are'} archived`)
  }

  const unpublished = questions.filter(
    (question) => question && question.status !== 'published' && question.status !== 'archived' && !question.deleted_at
  ).length
  if (unpublished > 0) {
    problems.push(`${unpublished} question${unpublished === 1 ? ' is' : 's are'} not published yet`)
  }

  if (problems.length > 0) {
    throw new Error(`This mock cannot be published because ${problems.join('; ')}.`)
  }
}

export async function setMockTestStatus(id: string, status: MockTestStatus, userId: string): Promise<void> {
  if (status === 'published') {
    await assertMockReadyForPublish(id)
  }

  const supabase = await createClient()
  const updates: Record<string, unknown> = {
    status,
    updated_by: userId,
  }
  // Only stamp published_at the first time; keep it stable across unpublish/republish
  // so historical "published since" reads true. archived_at set/cleared on archive.
  if (status === 'published') {
    updates.published_at = new Date().toISOString()
  }
  if (status === 'archived') {
    updates.archived_at = new Date().toISOString()
  } else {
    updates.archived_at = null
  }

  const { error } = await supabase.from('mock_tests').update(updates).eq('id', id)

  if (error) {
    throw new Error('Unable to change the mock test status.')
  }
}

export async function updateMockTestSection(
  sectionId: string,
  input: { name: string; timeLimitSeconds: number; breakAfterSeconds: number }
): Promise<void> {
  if (!input.name.trim()) {
    throw new Error('Enter a section name.')
  }
  if (input.timeLimitSeconds <= 0) {
    throw new Error('The section time limit must be positive.')
  }
  if (input.breakAfterSeconds < 0) {
    throw new Error('The break length cannot be negative.')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mock_test_sections')
    .update({
      name: input.name.trim(),
      time_limit_seconds: input.timeLimitSeconds,
      break_after_seconds: input.breakAfterSeconds,
    })
    .eq('id', sectionId)

  if (error) {
    throw new Error('Unable to update the section.')
  }
}

/** Appends bank questions to a section, skipping ones already in the mock. */
export async function addQuestionsToSection(
  mockTestId: string,
  sectionId: string,
  questionIds: string[]
): Promise<number> {
  if (questionIds.length === 0) {
    return 0
  }

  const supabase = await createClient()
  const [{ data: existing, error: existingError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from('mock_test_questions').select('question_id').eq('mock_test_id', mockTestId),
    supabase
      .from('mock_test_questions')
      .select('question_order')
      .eq('section_id', sectionId)
      .order('question_order', { ascending: false })
      .limit(1),
  ])

  if (existingError || ordersError) {
    throw new Error('Unable to check the mock test contents.')
  }

  const alreadyIn = new Set(((existing ?? []) as Array<{ question_id: string }>).map((row) => row.question_id))
  const newIds = questionIds.filter((questionId) => !alreadyIn.has(questionId))

  if (newIds.length === 0) {
    return 0
  }

  let nextOrder = (((orders ?? []) as Array<{ question_order: number }>)[0]?.question_order ?? 0) + 1
  const rows = newIds.map((questionId) => ({
    mock_test_id: mockTestId,
    section_id: sectionId,
    question_id: questionId,
    question_order: nextOrder++,
  }))

  const { error } = await supabase.from('mock_test_questions').insert(rows)

  if (error) {
    throw new Error('Unable to add the selected questions.')
  }

  return newIds.length
}

export async function removeMockTestQuestion(mockQuestionId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('mock_test_questions').delete().eq('id', mockQuestionId)

  if (error) {
    throw new Error('Unable to remove the question from the mock.')
  }
}

/** Swaps question_order with the neighbour above/below within the same section. */
export async function moveMockTestQuestion(mockQuestionId: string, direction: 'up' | 'down'): Promise<void> {
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('mock_test_questions')
    .select('id, section_id, question_order')
    .eq('id', mockQuestionId)
    .maybeSingle()

  if (currentError || !current) {
    throw new Error('Unable to find the question to move.')
  }

  let neighbourQuery = supabase
    .from('mock_test_questions')
    .select('id, question_order')
    .eq('section_id', current.section_id)
    .limit(1)

  neighbourQuery =
    direction === 'up'
      ? neighbourQuery.lt('question_order', current.question_order).order('question_order', { ascending: false })
      : neighbourQuery.gt('question_order', current.question_order).order('question_order', { ascending: true })

  const { data: neighbours, error: neighbourError } = await neighbourQuery

  if (neighbourError) {
    throw new Error('Unable to reorder the question.')
  }

  const neighbour = ((neighbours ?? []) as Array<{ id: string; question_order: number }>)[0]
  if (!neighbour) {
    return // Already at the edge of the section.
  }

  const [{ error: firstError }, { error: secondError }] = await Promise.all([
    supabase.from('mock_test_questions').update({ question_order: neighbour.question_order }).eq('id', current.id),
    supabase.from('mock_test_questions').update({ question_order: current.question_order }).eq('id', neighbour.id),
  ])

  if (firstError || secondError) {
    throw new Error('Unable to reorder the question.')
  }
}

/** Deep-copies a mock (header + sections + questions) as a new draft. */
export async function duplicateMockTest(id: string, userId: string): Promise<string> {
  const supabase = await createClient()
  const { data: source, error: sourceError } = await supabase
    .from('mock_tests')
    .select('title, description, exam_type, year_level, mock_type, instructions, difficulty_label')
    .eq('id', id)
    .maybeSingle()

  if (sourceError || !source) {
    throw new Error('Unable to load the mock test to duplicate.')
  }

  const { data: copy, error: copyError } = await supabase
    .from('mock_tests')
    .insert({
      title: `${source.title} (copy)`,
      description: source.description,
      exam_type: source.exam_type,
      year_level: source.year_level,
      mock_type: source.mock_type,
      instructions: source.instructions,
      difficulty_label: source.difficulty_label,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (copyError || !copy) {
    throw new Error('Unable to duplicate the mock test.')
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('mock_test_sections')
    .select('id, section_order, section_key, name, subject_id, time_limit_seconds, break_after_seconds')
    .eq('mock_test_id', id)
    .order('section_order', { ascending: true })

  if (sectionsError) {
    throw new Error('The mock was duplicated but its sections could not be copied.')
  }

  const sectionIdMap = new Map<string, string>()
  for (const section of (sections ?? []) as Array<{
    id: string
    section_order: number
    section_key: string
    name: string
    subject_id: string | null
    time_limit_seconds: number
    break_after_seconds: number
  }>) {
    const { data: inserted, error: insertError } = await supabase
      .from('mock_test_sections')
      .insert({
        mock_test_id: copy.id,
        section_order: section.section_order,
        section_key: section.section_key,
        name: section.name,
        subject_id: section.subject_id,
        time_limit_seconds: section.time_limit_seconds,
        break_after_seconds: section.break_after_seconds,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      throw new Error('The mock was duplicated but its sections could not be copied.')
    }
    sectionIdMap.set(section.id, inserted.id)
  }

  const { data: questions, error: questionsError } = await supabase
    .from('mock_test_questions')
    .select('section_id, question_id, question_order, marks')
    .eq('mock_test_id', id)

  if (questionsError) {
    throw new Error('The mock was duplicated but its questions could not be copied.')
  }

  const questionRows = ((questions ?? []) as Array<{
    section_id: string
    question_id: string
    question_order: number
    marks: number
  }>)
    .filter((row) => sectionIdMap.has(row.section_id))
    .map((row) => ({
      mock_test_id: copy.id,
      section_id: sectionIdMap.get(row.section_id)!,
      question_id: row.question_id,
      question_order: row.question_order,
      marks: row.marks,
    }))

  if (questionRows.length > 0) {
    const { error: insertQuestionsError } = await supabase.from('mock_test_questions').insert(questionRows)
    if (insertQuestionsError) {
      throw new Error('The mock was duplicated but its questions could not be copied.')
    }
  }

  return copy.id
}

// -- Student: sitting a curated mock ------------------------------------------

/** Whether an empty writing section is included when a student sits this mock. */
function includesWritingSection(mockType: MockType): boolean {
  return mockType === 'full_mock' || mockType === 'diagnostic'
}

/**
 * Starts a student's attempt at a published curated mock. Mirrors the mock's
 * sections and hand-picked questions (in admin order) into the existing mock
 * exam session tables — so the whole sectioned runner, grading, review and
 * revision routing are reused unchanged. The session is tagged with
 * mock_test_id and run as a 'randomised_full' (sectioned) session.
 *
 * Sections with no questions are skipped, except the Writing section, which is
 * included for full/diagnostic mocks as a free-response task. Returns null when
 * the mock is not published or has nothing for the student to do.
 */
export async function createCuratedMockSession(input: {
  studentId: string
  mockTestId: string
}): Promise<{ sessionId: string } | null> {
  const supabase = await createClient()

  const { data: mock, error: mockError } = await supabase
    .from('mock_tests')
    .select('id, exam_type, mock_type, status')
    .eq('id', input.mockTestId)
    .maybeSingle()

  if (mockError) {
    throw new Error('Unable to start this mock test.')
  }
  if (!mock || mock.status !== 'published') {
    return null
  }

  const [{ data: sectionRows, error: sectionsError }, { data: questionRows, error: questionsError }] =
    await Promise.all([
      supabase
        .from('mock_test_sections')
        .select('id, section_order, section_key, name, subject_id, time_limit_seconds, break_after_seconds')
        .eq('mock_test_id', input.mockTestId)
        .order('section_order', { ascending: true }),
      supabase
        .from('mock_test_questions')
        .select('section_id, question_id, question_order')
        .eq('mock_test_id', input.mockTestId)
        .order('question_order', { ascending: true }),
    ])

  if (sectionsError || questionsError) {
    throw new Error('Unable to load this mock test.')
  }

  const questionsBySection = new Map<string, Array<{ question_id: string; question_order: number }>>()
  for (const row of (questionRows ?? []) as Array<{ section_id: string; question_id: string; question_order: number }>) {
    const list = questionsBySection.get(row.section_id) ?? []
    list.push({ question_id: row.question_id, question_order: row.question_order })
    questionsBySection.set(row.section_id, list)
  }

  const withWriting = includesWritingSection(mock.mock_type as MockType)

  // Keep only sections a student should actually sit, densely renumbered.
  const includedSections = (
    (sectionRows ?? []) as Array<{
      id: string
      section_order: number
      section_key: string
      name: string
      subject_id: string | null
      time_limit_seconds: number
      break_after_seconds: number
    }>
  ).filter((section) => {
    const count = questionsBySection.get(section.id)?.length ?? 0
    if (count > 0) {
      return true
    }
    return section.section_key === 'writing' && withWriting
  })

  const totalQuestions = includedSections.reduce(
    (sum, section) => sum + (questionsBySection.get(section.id)?.length ?? 0),
    0
  )

  // Nothing for the student to do (no MCQs and no writing task).
  if (includedSections.length === 0 || (totalQuestions === 0 && !includedSections.some((s) => s.section_key === 'writing'))) {
    return null
  }

  const totalTimeLimit = includedSections.reduce((sum, section) => sum + section.time_limit_seconds, 0)

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .insert({
      student_id: input.studentId,
      mock_test_id: input.mockTestId,
      mock_type: 'randomised_full',
      exam_type: mock.exam_type,
      subject_id: null,
      status: 'in_progress',
      time_limit_seconds: totalTimeLimit,
      total_questions: totalQuestions,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error('Unable to start this mock test.')
  }

  const nowIso = new Date().toISOString()
  const sessionSectionRows = includedSections.map((section, index) => ({
    session_id: session.id,
    section_order: index + 1,
    section_key: section.section_key,
    subject_id: section.subject_id,
    status: index === 0 ? 'in_progress' : 'pending',
    time_limit_seconds: section.time_limit_seconds,
    // No break after the last included section.
    break_after_seconds: index === includedSections.length - 1 ? 0 : section.break_after_seconds,
    started_at: index === 0 ? nowIso : null,
    total_questions: questionsBySection.get(section.id)?.length ?? 0,
  }))

  const { data: insertedSections, error: insertSectionsError } = await supabase
    .from('mock_exam_session_sections')
    .insert(sessionSectionRows)
    .select('id, section_order')

  if (insertSectionsError || !insertedSections) {
    throw new Error('Unable to prepare the sections for this mock test.')
  }

  const sessionSectionIdByOrder = new Map(
    (insertedSections as Array<{ id: string; section_order: number }>).map((section) => [
      section.section_order,
      section.id,
    ])
  )

  const sessionQuestionRows: Record<string, unknown>[] = []
  let questionOrder = 0
  includedSections.forEach((section, index) => {
    const sectionQuestions = questionsBySection.get(section.id) ?? []
    for (const question of sectionQuestions) {
      questionOrder += 1
      sessionQuestionRows.push({
        session_id: session.id,
        question_id: question.question_id,
        question_order: questionOrder,
        section_id: sessionSectionIdByOrder.get(index + 1) ?? null,
        is_flagged: false,
      })
    }
  })

  if (sessionQuestionRows.length > 0) {
    const { error: insertQuestionsError } = await supabase
      .from('mock_exam_session_questions')
      .insert(sessionQuestionRows)

    if (insertQuestionsError) {
      throw new Error('Unable to prepare the questions for this mock test.')
    }
  }

  return { sessionId: session.id }
}
