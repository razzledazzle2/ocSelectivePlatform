'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  addQuestionsToSection,
  createMockTest,
  duplicateMockTest,
  moveMockTestQuestion,
  removeMockTestQuestion,
  setMockTestStatus,
  updateMockDisplayOrder,
  updateMockTestMeta,
  updateMockTestSection,
} from '@/lib/mock-tests/mutations'
import {
  MOCK_TEST_STATUSES,
  MOCK_TYPES,
  type MockTestMetaInput,
  type MockTestStatus,
  type MockType,
} from '@/lib/mock-tests/types'
import { getMockProgramCoverage, type MockProgramFilters } from '@/lib/mock-tests/queries'
import type { MockProgramCoverage } from '@/lib/mock-tests/types'
import { getBlueprintSelectionPool, getMockBlueprintById } from '@/lib/mock-blueprints/queries'
import { selectQuestionsForBlueprint } from '@/lib/mock-blueprints/select'
import { evaluateBlueprint } from '@/lib/mock-blueprints/evaluate'
import type { BlueprintEvaluation, BlueprintQuestion } from '@/lib/mock-blueprints/types'
import { createClient } from '@/lib/supabase/server'
import { getAdminQuestionsPage } from '@/lib/questions/queries'
import {
  ADMIN_PORTAL_ROLES,
  EXAM_TYPES,
  type ActionResult,
  type AdminQuestionListItem,
  type AdminQuestionsPage,
  type ExamType,
} from '@/lib/types'

function revalidateMockPaths(id?: string) {
  revalidatePath('/admin/mocks')
  if (id) {
    revalidatePath(`/admin/mocks/${id}`)
  }
}

function parseMeta(formData: FormData): { input?: MockTestMetaInput; error?: ActionResult } {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const examType = String(formData.get('examType') ?? '')
  const yearLevelRaw = String(formData.get('yearLevel') ?? '').trim()
  const yearLevel = yearLevelRaw ? Number(yearLevelRaw) : null
  const mockType = String(formData.get('mockType') ?? 'full_mock')
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  const difficultyLabel = String(formData.get('difficultyLabel') ?? '').trim() || null

  const fieldErrors: Record<string, string> = {}
  if (!title) {
    fieldErrors.title = 'Enter a title.'
  }
  if (!(EXAM_TYPES as readonly string[]).includes(examType)) {
    fieldErrors.examType = 'Choose an exam type.'
  }
  if (!(MOCK_TYPES as readonly string[]).includes(mockType)) {
    fieldErrors.mockType = 'Choose a mock type.'
  }
  if (yearLevel !== null && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 12)) {
    fieldErrors.yearLevel = 'Year level must be between 1 and 12.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: { success: false, message: 'Please fix the highlighted fields.', fieldErrors } }
  }

  return {
    input: {
      title,
      description,
      examType: examType as ExamType,
      yearLevel,
      mockType: mockType as MockType,
      instructions,
      difficultyLabel,
    },
  }
}

export async function createMockTestAction(
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { input, error } = parseMeta(formData)
  if (error || !input) {
    return error!
  }

  try {
    const id = await createMockTest(input, profile.id)
    revalidateMockPaths(id)
    return {
      success: true,
      message: 'Mock test created with the full exam section structure.',
      data: { redirectTo: `/admin/mocks/${id}` },
    }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to create the mock test.',
    }
  }
}

export async function updateMockTestMetaAction(id: string, formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { input, error } = parseMeta(formData)
  if (error || !input) {
    return error!
  }

  try {
    await updateMockTestMeta(id, input, profile.id)
    revalidateMockPaths(id)
    return { success: true, message: 'Mock test details saved.' }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to save the mock test details.',
    }
  }
}

export async function setMockTestStatusAction(id: string, status: MockTestStatus): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!MOCK_TEST_STATUSES.includes(status)) {
    return { success: false, message: 'Unknown status.' }
  }

  try {
    await setMockTestStatus(id, status, profile.id)
    revalidateMockPaths(id)
    const label =
      status === 'published' ? 'Mock published.' : status === 'archived' ? 'Mock archived.' : 'Mock moved to draft.'
    return { success: true, message: label }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to change the mock status.',
    }
  }
}

export async function duplicateMockTestAction(id: string): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const copyId = await duplicateMockTest(id, profile.id)
    revalidateMockPaths(copyId)
    return {
      success: true,
      message: 'Mock duplicated as a new draft.',
      data: { redirectTo: `/admin/mocks/${copyId}` },
    }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to duplicate the mock test.',
    }
  }
}

export async function updateMockSectionAction(
  mockTestId: string,
  sectionId: string,
  input: { name: string; timeLimitSeconds: number; breakAfterSeconds: number }
): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await updateMockTestSection(sectionId, input)
    revalidateMockPaths(mockTestId)
    return { success: true, message: 'Section updated.' }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to update the section.',
    }
  }
}

export async function addMockQuestionsAction(
  mockTestId: string,
  sectionId: string,
  questionIds: string[]
): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const added = await addQuestionsToSection(mockTestId, sectionId, questionIds)
    revalidateMockPaths(mockTestId)
    if (added === 0) {
      return { success: true, message: 'All selected questions were already in this mock.' }
    }
    const skipped = questionIds.length - added
    return {
      success: true,
      message:
        skipped > 0
          ? `${added} question${added === 1 ? '' : 's'} added (${skipped} already in the mock).`
          : `${added} question${added === 1 ? '' : 's'} added.`,
    }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to add the questions.',
    }
  }
}

export async function removeMockQuestionAction(mockTestId: string, mockQuestionId: string): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await removeMockTestQuestion(mockQuestionId)
    revalidateMockPaths(mockTestId)
    return { success: true, message: 'Question removed from the mock.' }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to remove the question.',
    }
  }
}

export async function moveMockQuestionAction(
  mockTestId: string,
  mockQuestionId: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await moveMockTestQuestion(mockQuestionId, direction)
    revalidateMockPaths(mockTestId)
    return { success: true }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to reorder the question.',
    }
  }
}

export async function updateMockDisplayOrderAction(id: string, displayOrder: number): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    return { success: false, message: 'Order must be a whole number of 0 or more.' }
  }

  try {
    await updateMockDisplayOrder(id, displayOrder, profile.id)
    revalidateMockPaths(id)
    return { success: true, message: 'Order updated.' }
  } catch (caught) {
    return {
      success: false,
      message: caught instanceof Error ? caught.message : 'Unable to update the order.',
    }
  }
}

/** Coverage across all published mocks, re-fetched when the admin changes filters. */
export async function getMockProgramCoverageAction(
  filters: MockProgramFilters
): Promise<ActionResult<MockProgramCoverage>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const data = await getMockProgramCoverage(filters)
    return { success: true, data }
  } catch {
    return { success: false, message: 'Unable to load program coverage.' }
  }
}

/** Bank search for the "add questions" picker — same paginated query as the Question Bank. */
export async function searchBankQuestionsAction(filters: {
  query?: string
  subjectId?: string
  topicId?: string
  tag?: string
  difficulty?: string
  status?: string
  page?: string
}): Promise<ActionResult<AdminQuestionsPage>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const data = await getAdminQuestionsPage({ ...filters, pageSize: '10', sort: 'updated_desc' })
    return { success: true, data }
  } catch {
    return { success: false, message: 'Unable to search the question bank.' }
  }
}

/**
 * Assisted selection: given target filters and a count, suggests published bank
 * questions the admin can review before adding — never auto-added, never
 * auto-published. Excludes questions already in the mock. Prefers a spread by
 * fetching a wider pool and trimming to the requested count.
 */
export async function assistedMockSuggestionsAction(input: {
  subjectId?: string
  topicId?: string
  difficulty?: string
  count: number
  excludeQuestionIds: string[]
  includeUnpublished?: boolean
}): Promise<ActionResult<{ questions: AdminQuestionListItem[] }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  const count = Math.max(1, Math.min(50, Math.round(input.count || 0)))

  try {
    const page = await getAdminQuestionsPage({
      subjectId: input.subjectId,
      topicId: input.topicId,
      difficulty: input.difficulty,
      status: input.includeUnpublished ? undefined : 'published',
      answerFormat: 'single_choice',
      pageSize: '100',
      sort: 'updated_desc',
    })

    const exclude = new Set(input.excludeQuestionIds)
    const questions = page.items.filter((item) => !exclude.has(item.id)).slice(0, count)

    return { success: true, data: { questions } }
  } catch {
    return { success: false, message: 'Unable to build suggestions from the question bank.' }
  }
}

/**
 * Automatic (internal) builder: deterministically fill a section from a blueprint.
 * Selects published bank questions satisfying the blueprint, excluding questions
 * already in the mock, then appends them. Never publishes; the admin still reviews.
 */
export async function autoFillMockSectionAction(input: {
  mockTestId: string
  sectionId: string
  blueprintId: string
  seed?: number
  targetCount?: number
}): Promise<ActionResult<{ added: number; evaluation: BlueprintEvaluation | null; notes: string[] }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const blueprint = await getMockBlueprintById(input.blueprintId)
    if (!blueprint) {
      return { success: false, message: 'Blueprint not found.' }
    }

    const supabase = await createClient()
    const [{ data: section }, { data: existing }] = await Promise.all([
      supabase.from('mock_test_sections').select('subject_id').eq('id', input.sectionId).maybeSingle(),
      supabase.from('mock_test_questions').select('question_id').eq('mock_test_id', input.mockTestId),
    ])

    if (!section?.subject_id) {
      return { success: false, message: 'This section has no subject to draw questions from.' }
    }

    const exclude = new Set(((existing ?? []) as Array<{ question_id: string }>).map((row) => row.question_id))
    const pool = await getBlueprintSelectionPool(section.subject_id)
    const { selected, notes } = selectQuestionsForBlueprint(pool, blueprint.spec, {
      seed: input.seed ?? 1,
      exclude,
      targetCount: input.targetCount,
    })

    if (selected.length === 0) {
      return { success: true, data: { added: 0, evaluation: null, notes }, message: 'No eligible questions matched the blueprint.' }
    }

    const added = await addQuestionsToSection(
      input.mockTestId,
      input.sectionId,
      selected.map((candidate) => candidate.questionId)
    )
    const evaluation = evaluateBlueprint(selected, blueprint.spec, {
      blueprintId: blueprint.id,
      blueprintTitle: blueprint.title,
    })
    revalidateMockPaths(input.mockTestId)
    return {
      success: true,
      data: { added, evaluation, notes },
      message: `${added} question${added === 1 ? '' : 's'} added from “${blueprint.title}”.`,
    }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to auto-fill from the blueprint.' }
  }
}

/** Evaluate the mock's current questions against a blueprint (compliance panel). */
export async function evaluateMockBlueprintAction(
  mockTestId: string,
  blueprintId: string
): Promise<ActionResult<BlueprintEvaluation>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    const blueprint = await getMockBlueprintById(blueprintId)
    if (!blueprint) return { success: false, message: 'Blueprint not found.' }

    const supabase = await createClient()
    const { data: rows } = await supabase
      .from('mock_test_questions')
      .select('question:questions(difficulty, domain_code, subtopic_code, pattern_key, correct_option_label)')
      .eq('mock_test_id', mockTestId)

    const questions: BlueprintQuestion[] = ((rows ?? []) as Array<{
      question:
        | { difficulty: number; domain_code: string | null; subtopic_code: string | null; pattern_key: string | null; correct_option_label: string | null }[]
        | { difficulty: number; domain_code: string | null; subtopic_code: string | null; pattern_key: string | null; correct_option_label: string | null }
        | null
    }>)
      .map((row) => (Array.isArray(row.question) ? row.question[0] : row.question))
      .filter((question): question is NonNullable<typeof question> => question != null)
      .map((question) => ({
        difficulty: question.difficulty,
        domainCode: question.domain_code,
        subtopicCode: question.subtopic_code,
        patternKey: question.pattern_key,
        correctOptionLabel: question.correct_option_label,
      }))

    const evaluation = evaluateBlueprint(questions, blueprint.spec, {
      blueprintId: blueprint.id,
      blueprintTitle: blueprint.title,
    })
    return { success: true, data: evaluation }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to evaluate the blueprint.' }
  }
}
