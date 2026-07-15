import { getRelationValue, getStudentStimuliMap } from '@/lib/practice/hydration'
import { getPracticeQuestionsByIds, hydratePracticeQuestions } from '@/lib/practice/queries'
import { readingItemReveal } from '@/lib/question-sets/core'
import { createClient } from '@/lib/supabase/server'
import type {
  AvailableReadingSet,
  ExamType,
  PracticeQuestionItem,
  QuestionOptionLabel,
  QuestionSetMembership,
  QuestionSetType,
  ReadingSessionData,
  ReadingSet,
  ReadingSetItem,
  SetCompletionMode,
  SetFeedbackMode,
  SetInteractionType,
  SharedOptionPool,
  SharedOptionPoolOption,
} from '@/lib/types'

/** A reading set with its ordered member question ids (server-internal shape). */
export interface ReadingSetOutline {
  setId: string
  externalRef: string | null
  title: string
  setType: QuestionSetType
  instructions: string | null
  feedbackMode: SetFeedbackMode
  completionMode: SetCompletionMode
  interactionType: SetInteractionType | null
  stimulusId: string | null
  sharedOptionPoolId: string | null
  /** Member question ids in position order. */
  questionIds: string[]
}

interface SetItemRow {
  set_id: string
  question_id: string
  position: number
  target_label: string | null
  question:
    | { id: string; subject_id: string; exam_type: ExamType; status: string; origin: string; deleted_at: string | null }
    | Array<{ id: string; subject_id: string; exam_type: ExamType; status: string; origin: string; deleted_at: string | null }>
    | null
  set:
    | {
        id: string
        external_ref: string | null
        title: string
        set_type: QuestionSetType
        instructions: string | null
        feedback_mode: SetFeedbackMode
        completion_mode: SetCompletionMode
        interaction_type: SetInteractionType | null
        stimulus_id: string | null
        shared_option_pool_id: string | null
      }
    | Array<{
        id: string
        external_ref: string | null
        title: string
        set_type: QuestionSetType
        instructions: string | null
        feedback_mode: SetFeedbackMode
        completion_mode: SetCompletionMode
        interaction_type: SetInteractionType | null
        stimulus_id: string | null
        shared_option_pool_id: string | null
      }>
    | null
}

/**
 * All complete, published reading sets for a subject/exam, each with its member
 * question ids in position order. Sets are ordered deterministically (title,
 * then external ref) so "the first N sets" is stable. Only published, non-deleted
 * bank questions count toward a set — a set with none is omitted.
 */
export async function getReadingSetOutlines(
  examType: ExamType,
  subjectId: string
): Promise<ReadingSetOutline[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_set_items')
    .select(
      `
      set_id,
      question_id,
      position,
      target_label,
      question:questions!inner(id, subject_id, exam_type, status, origin, deleted_at),
      set:question_sets!inner(
        id, external_ref, title, set_type, instructions,
        feedback_mode, completion_mode, interaction_type, stimulus_id, shared_option_pool_id
      )
    `
    )
    .eq('question.status', 'published')
    .eq('question.origin', 'bank')
    .is('question.deleted_at', null)
    .eq('question.subject_id', subjectId)
    .eq('question.exam_type', examType)
    .order('position', { ascending: true })

  if (error) {
    throw new Error('Unable to load reading sets.')
  }

  const rows = (data ?? []) as unknown as SetItemRow[]
  const outlines = new Map<string, ReadingSetOutline>()

  for (const row of rows) {
    const set = getRelationValue(row.set)
    const question = getRelationValue(row.question)
    if (!set || !question) continue

    const outline =
      outlines.get(set.id) ??
      ({
        setId: set.id,
        externalRef: set.external_ref,
        title: set.title,
        setType: set.set_type,
        instructions: set.instructions,
        feedbackMode: set.feedback_mode,
        completionMode: set.completion_mode,
        interactionType: set.interaction_type,
        stimulusId: set.stimulus_id,
        sharedOptionPoolId: set.shared_option_pool_id,
        questionIds: [],
      } satisfies ReadingSetOutline)

    outline.questionIds.push(question.id)
    outlines.set(set.id, outline)
  }

  return [...outlines.values()].sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title)
    return byTitle !== 0 ? byTitle : (a.externalRef ?? '').localeCompare(b.externalRef ?? '')
  })
}

/** The reading-set catalogue for the practice setup screen. */
export async function getAvailableReadingSets(
  examType: ExamType,
  subjectId: string
): Promise<AvailableReadingSet[]> {
  const outlines = await getReadingSetOutlines(examType, subjectId)
  return outlines.map((outline) => ({
    id: outline.setId,
    title: outline.title,
    setType: outline.setType,
    questionCount: outline.questionIds.length,
  }))
}

/**
 * A question's reading-set membership for the admin preview: its set, position,
 * total siblings, target gap, and the shared option pool (if any). Null when the
 * question belongs to no set.
 */
export async function getQuestionSetMembership(questionId: string): Promise<QuestionSetMembership | null> {
  const supabase = await createClient()

  const { data: item, error: itemError } = await supabase
    .from('question_set_items')
    .select(
      `
      set_id,
      position,
      target_label,
      set:question_sets!inner(
        id, external_ref, title, set_type, feedback_mode, completion_mode, interaction_type, shared_option_pool_id
      )
    `
    )
    .eq('question_id', questionId)
    .maybeSingle()

  if (itemError || !item) {
    return null
  }

  const set = getRelationValue(
    item.set as
      | {
          id: string
          external_ref: string | null
          title: string
          set_type: QuestionSetType
          feedback_mode: SetFeedbackMode
          completion_mode: SetCompletionMode
          interaction_type: SetInteractionType | null
          shared_option_pool_id: string | null
        }
      | Array<{
          id: string
          external_ref: string | null
          title: string
          set_type: QuestionSetType
          feedback_mode: SetFeedbackMode
          completion_mode: SetCompletionMode
          interaction_type: SetInteractionType | null
          shared_option_pool_id: string | null
        }>
      | null
  )
  if (!set) {
    return null
  }

  const { count } = await supabase
    .from('question_set_items')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', set.id)

  const sharedPool = set.shared_option_pool_id
    ? (await getSharedOptionPoolsMap([set.shared_option_pool_id])).get(set.shared_option_pool_id) ?? null
    : null

  return {
    setId: set.id,
    externalRef: set.external_ref,
    title: set.title,
    setType: set.set_type,
    feedbackMode: set.feedback_mode,
    completionMode: set.completion_mode,
    interactionType: set.interaction_type,
    position: (item.position as number) ?? 1,
    totalItems: count ?? 0,
    targetLabel: (item.target_label as string | null) ?? null,
    sharedOptionPool: sharedPool,
  }
}

interface SharedPoolRow {
  id: string
  external_ref: string | null
  title: string | null
  options: unknown
}

/** Loads shared option pools by id into a map (parsed into typed options). */
async function getSharedOptionPoolsMap(poolIds: string[]): Promise<Map<string, SharedOptionPool>> {
  const map = new Map<string, SharedOptionPool>()
  const uniqueIds = [...new Set(poolIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return map
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shared_option_pools')
    .select('id, external_ref, title, options')
    .in('id', uniqueIds)

  if (error) {
    throw new Error('Unable to load the shared sentence bank.')
  }

  for (const row of (data ?? []) as SharedPoolRow[]) {
    map.set(row.id, {
      id: row.id,
      externalRef: row.external_ref,
      title: row.title,
      options: parsePoolOptions(row.options),
    })
  }

  return map
}

function parsePoolOptions(value: unknown): SharedOptionPoolOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  const options: SharedOptionPoolOption[] = []
  for (const entry of value) {
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      const label = typeof record.label === 'string' ? record.label : null
      const text = typeof record.text === 'string' ? record.text : null
      if (label && text) {
        options.push({ label: label as QuestionOptionLabel, text })
      }
    }
  }
  return options
}

interface PracticeSetAnswerRow {
  set_id: string | null
  question_id: string
  position: number
  selected_option_label: QuestionOptionLabel | null
  is_submitted: boolean
  is_correct: boolean | null
}

/**
 * Reconstructs a reading practice session: its sets (in order), each set's
 * stimulus + shared sentence bank, and every child question with the student's
 * saved answer. Correct answers/worked solutions are attached ONLY for
 * questions whose set has already been submitted — never leaked mid-set.
 */
export async function getReadingSessionData(
  sessionId: string,
  studentId: string
): Promise<ReadingSessionData | null> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .select('id, student_id, exam_type, subject_id, completed_at, subject:subjects(name)')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (sessionError) {
    throw new Error('Unable to load this reading session.')
  }
  if (!session) {
    return null
  }

  const { data: answerRows, error: answersError } = await supabase
    .from('practice_set_answers')
    .select('set_id, question_id, position, selected_option_label, is_submitted, is_correct')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  if (answersError) {
    throw new Error('Unable to load your saved answers.')
  }

  const answers = (answerRows ?? []) as PracticeSetAnswerRow[]
  if (answers.length === 0) {
    return {
      sessionId,
      examType: (session.exam_type as ExamType) ?? 'Selective',
      subjectId: (session.subject_id as string) ?? '',
      subjectName: getRelationValue(session.subject as { name: string } | { name: string }[] | null)?.name ?? 'Reading',
      completedAt: (session.completed_at as string | null) ?? null,
      sets: [],
    }
  }

  // Set ids in first-seen order (answers are already position-ordered).
  const setIds: string[] = []
  for (const answer of answers) {
    if (answer.set_id && !setIds.includes(answer.set_id)) {
      setIds.push(answer.set_id)
    }
  }

  const questionIds = answers.map((answer) => answer.question_id)

  const [sets, hydrated, revealMeta] = await Promise.all([
    loadSetMeta(setIds),
    hydratePracticeQuestions(await getPracticeQuestionsByIds(questionIds)),
    loadRevealMeta(answers.filter((answer) => answer.is_submitted).map((answer) => answer.question_id)),
  ])

  const [stimuliMap, poolsMap] = await Promise.all([
    getStudentStimuliMap(sets.map((set) => set.stimulusId).filter((id): id is string => Boolean(id))),
    getSharedOptionPoolsMap(sets.map((set) => set.sharedOptionPoolId).filter((id): id is string => Boolean(id))),
  ])

  const questionById = new Map<string, PracticeQuestionItem>(hydrated.map((item) => [item.id, item]))

  const readingSets: ReadingSet[] = sets.map((set) => {
    const setAnswers = answers.filter((answer) => answer.set_id === set.setId)
    const items: ReadingSetItem[] = setAnswers
      .map((answer) => {
        const question = questionById.get(answer.question_id)
        if (!question) return null
        const reveal = revealMeta.get(answer.question_id)
        // Correctness/solution are gated behind submission by readingItemReveal.
        const revealed = readingItemReveal(answer.is_submitted, {
          isCorrect: answer.is_correct,
          correctOptionLabel: reveal?.correctOptionLabel ?? null,
          workedSolution: reveal?.workedSolution ?? '',
        })
        const item: ReadingSetItem = {
          position: answer.position,
          targetLabel: set.targetLabels.get(answer.question_id) ?? null,
          question,
          savedAnswer: answer.selected_option_label,
          isSubmitted: answer.is_submitted,
          isCorrect: revealed.isCorrect,
          correctOptionLabel: revealed.correctOptionLabel,
          workedSolution: revealed.workedSolution,
        }
        return item
      })
      .filter((item): item is ReadingSetItem => item !== null)
      .sort((a, b) => a.position - b.position)

    return {
      id: set.setId,
      externalRef: set.externalRef,
      title: set.title,
      setType: set.setType,
      instructions: set.instructions,
      feedbackMode: set.feedbackMode,
      completionMode: set.completionMode,
      interactionType: set.interactionType,
      stimulus: set.stimulusId ? stimuliMap.get(set.stimulusId) ?? null : null,
      sharedOptions: set.sharedOptionPoolId ? poolsMap.get(set.sharedOptionPoolId) ?? null : null,
      items,
      isSubmitted: items.length > 0 && items.every((item) => item.isSubmitted),
    }
  })

  return {
    sessionId,
    examType: (session.exam_type as ExamType) ?? 'Selective',
    subjectId: (session.subject_id as string) ?? '',
    subjectName: getRelationValue(session.subject as { name: string } | { name: string }[] | null)?.name ?? 'Reading',
    completedAt: (session.completed_at as string | null) ?? null,
    sets: readingSets,
  }
}

interface SetMeta {
  setId: string
  externalRef: string | null
  title: string
  setType: QuestionSetType
  instructions: string | null
  feedbackMode: SetFeedbackMode
  completionMode: SetCompletionMode
  interactionType: SetInteractionType | null
  stimulusId: string | null
  sharedOptionPoolId: string | null
  /** question_id → target gap label, for sentence insertion. */
  targetLabels: Map<string, string>
}

async function loadSetMeta(setIds: string[]): Promise<SetMeta[]> {
  if (setIds.length === 0) {
    return []
  }
  const supabase = await createClient()
  const [{ data: sets, error: setsError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('question_sets')
      .select(
        'id, external_ref, title, set_type, instructions, feedback_mode, completion_mode, interaction_type, stimulus_id, shared_option_pool_id'
      )
      .in('id', setIds),
    supabase.from('question_set_items').select('set_id, question_id, target_label').in('set_id', setIds),
  ])

  if (setsError || itemsError) {
    throw new Error('Unable to load reading set details.')
  }

  const targetLabelsBySet = new Map<string, Map<string, string>>()
  for (const item of (items ?? []) as Array<{ set_id: string; question_id: string; target_label: string | null }>) {
    const map = targetLabelsBySet.get(item.set_id) ?? new Map<string, string>()
    if (item.target_label) {
      map.set(item.question_id, item.target_label)
    }
    targetLabelsBySet.set(item.set_id, map)
  }

  const bySetId = new Map<string, SetMeta>()
  for (const set of (sets ?? []) as Array<{
    id: string
    external_ref: string | null
    title: string
    set_type: QuestionSetType
    instructions: string | null
    feedback_mode: SetFeedbackMode
    completion_mode: SetCompletionMode
    interaction_type: SetInteractionType | null
    stimulus_id: string | null
    shared_option_pool_id: string | null
  }>) {
    bySetId.set(set.id, {
      setId: set.id,
      externalRef: set.external_ref,
      title: set.title,
      setType: set.set_type,
      instructions: set.instructions,
      feedbackMode: set.feedback_mode,
      completionMode: set.completion_mode,
      interactionType: set.interaction_type,
      stimulusId: set.stimulus_id,
      sharedOptionPoolId: set.shared_option_pool_id,
      targetLabels: targetLabelsBySet.get(set.id) ?? new Map(),
    })
  }

  // Preserve the caller's set order.
  return setIds.map((id) => bySetId.get(id)).filter((meta): meta is SetMeta => Boolean(meta))
}

interface RevealMeta {
  correctOptionLabel: QuestionOptionLabel | null
  workedSolution: string
}

/** Loads correct answers + worked solutions for already-submitted questions only. */
async function loadRevealMeta(questionIds: string[]): Promise<Map<string, RevealMeta>> {
  const map = new Map<string, RevealMeta>()
  const uniqueIds = [...new Set(questionIds)]
  if (uniqueIds.length === 0) {
    return map
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('id, correct_option_label, worked_solution, short_explanation')
    .in('id', uniqueIds)

  if (error) {
    throw new Error('Unable to load the answer key for submitted questions.')
  }

  for (const row of (data ?? []) as Array<{
    id: string
    correct_option_label: QuestionOptionLabel | null
    worked_solution: string | null
    short_explanation: string | null
  }>) {
    map.set(row.id, {
      correctOptionLabel: row.correct_option_label,
      workedSolution: row.worked_solution ?? row.short_explanation ?? '',
    })
  }

  return map
}
