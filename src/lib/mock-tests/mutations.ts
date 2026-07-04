import { SECTIONED_MOCK_SECTIONS } from '@/lib/mock-exams/config'
import { createClient } from '@/lib/supabase/server'
import type { MockTestMetaInput, MockTestStatus } from '@/lib/mock-tests/types'

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
      updated_by: userId,
    })
    .eq('id', id)

  if (error) {
    throw new Error('Unable to update the mock test details.')
  }
}

export async function setMockTestStatus(id: string, status: MockTestStatus, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mock_tests')
    .update({
      status,
      updated_by: userId,
      published_at: status === 'published' ? new Date().toISOString() : null,
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', id)

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
    .select('title, description, exam_type, year_level')
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
