import { createClient } from '@/lib/supabase/server'

/**
 * The official Skill Library categories per subject slug. Topics in this list
 * always appear in the library (even with an empty bank, so students can see
 * what is coming); other topics appear only once they hold published questions.
 * Writing intentionally has no categories yet.
 */
export const SKILL_LIBRARY_CATEGORY_SLUGS: Record<string, string[]> = {
  reading: ['cloze-passage', 'extracts', 'narrative', 'poetry'],
  'mathematical-reasoning': [
    'area',
    'perimeter',
    'time',
    'algebra',
    'arithmetic-operations',
    'decimals',
    'fractions',
    'percentages',
    'probability',
  ],
  'thinking-skills': [
    'drawing-conclusions',
    'arguments',
    'logic',
    'mathematical-analysis',
    'abstract-reasoning',
  ],
  writing: [],
}

/** Minimum attempts in a category before an accuracy/mastery figure is shown. */
const CATEGORY_ACCURACY_MIN_ATTEMPTS = 3

export interface SkillCategorySummary {
  topicId: string
  name: string
  slug: string
  description: string | null
  questionCount: number
  attempts: number
  correct: number
  /** Percentage 0–100, or null until the student has enough attempts. */
  accuracy: number | null
  dueCount: number
  masteredCount: number
  trackedCount: number
}

export interface SkillSubjectSummary {
  subjectId: string
  name: string
  slug: string
  description: string | null
  questionCount: number
  attempts: number
  accuracy: number | null
  dueCount: number
  categories: SkillCategorySummary[]
}

export async function getSkillLibraryData(studentId: string): Promise<SkillSubjectSummary[]> {
  const supabase = await createClient()
  const nowMs = Date.now()

  const [subjectsResult, topicsResult, questionsResult, attemptsResult, mistakesResult] =
    await Promise.all([
      supabase
        .from('subjects')
        .select('id, name, slug, description, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('topics')
        .select('id, subject_id, name, slug, description, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('questions').select('id, subject_id, topic_id').eq('status', 'published'),
      supabase
        .from('question_attempts')
        .select('subject_id, topic_id, is_correct')
        .eq('student_id', studentId),
      supabase
        .from('student_mistake_questions')
        .select('subject_id, topic_id, status, next_review_at')
        .eq('student_id', studentId),
    ])

  if (subjectsResult.error || topicsResult.error || questionsResult.error) {
    throw new Error('Unable to load the skill library.')
  }

  const subjects = subjectsResult.data ?? []
  const topics = topicsResult.data ?? []
  const questions = questionsResult.data ?? []
  // Personal stats are progressive enhancement: tolerate failures with empty data.
  const attempts = attemptsResult.data ?? []
  const mistakes = mistakesResult.data ?? []

  const questionCountByTopic = new Map<string, number>()
  const questionCountBySubject = new Map<string, number>()
  for (const question of questions) {
    if (question.topic_id) {
      questionCountByTopic.set(question.topic_id, (questionCountByTopic.get(question.topic_id) ?? 0) + 1)
    }
    questionCountBySubject.set(
      question.subject_id,
      (questionCountBySubject.get(question.subject_id) ?? 0) + 1
    )
  }

  const attemptStatsByTopic = new Map<string, { attempts: number; correct: number }>()
  const attemptStatsBySubject = new Map<string, { attempts: number; correct: number }>()
  for (const attempt of attempts) {
    if (attempt.topic_id) {
      const topicStats = attemptStatsByTopic.get(attempt.topic_id) ?? { attempts: 0, correct: 0 }
      topicStats.attempts += 1
      if (attempt.is_correct) topicStats.correct += 1
      attemptStatsByTopic.set(attempt.topic_id, topicStats)
    }
    if (attempt.subject_id) {
      const subjectStats = attemptStatsBySubject.get(attempt.subject_id) ?? { attempts: 0, correct: 0 }
      subjectStats.attempts += 1
      if (attempt.is_correct) subjectStats.correct += 1
      attemptStatsBySubject.set(attempt.subject_id, subjectStats)
    }
  }

  const mistakeStatsByTopic = new Map<string, { due: number; mastered: number; tracked: number }>()
  const dueBySubject = new Map<string, number>()
  for (const mistake of mistakes) {
    const isDue =
      mistake.status !== 'mastered' &&
      mistake.next_review_at !== null &&
      new Date(mistake.next_review_at).getTime() <= nowMs

    if (mistake.topic_id) {
      const stats = mistakeStatsByTopic.get(mistake.topic_id) ?? { due: 0, mastered: 0, tracked: 0 }
      stats.tracked += 1
      if (mistake.status === 'mastered') stats.mastered += 1
      if (isDue) stats.due += 1
      mistakeStatsByTopic.set(mistake.topic_id, stats)
    }
    if (mistake.subject_id && isDue) {
      dueBySubject.set(mistake.subject_id, (dueBySubject.get(mistake.subject_id) ?? 0) + 1)
    }
  }

  return subjects.map((subject) => {
    const categorySlugs = SKILL_LIBRARY_CATEGORY_SLUGS[subject.slug]
    const subjectTopics = topics.filter((topic) => topic.subject_id === subject.id)

    const categories: SkillCategorySummary[] = subjectTopics
      .filter((topic) => {
        const isOfficialCategory = categorySlugs?.includes(topic.slug) ?? false
        return isOfficialCategory || (questionCountByTopic.get(topic.id) ?? 0) > 0
      })
      .map((topic) => {
        const attemptStats = attemptStatsByTopic.get(topic.id) ?? { attempts: 0, correct: 0 }
        const mistakeStats = mistakeStatsByTopic.get(topic.id) ?? { due: 0, mastered: 0, tracked: 0 }

        return {
          topicId: topic.id,
          name: topic.name,
          slug: topic.slug,
          description: topic.description,
          questionCount: questionCountByTopic.get(topic.id) ?? 0,
          attempts: attemptStats.attempts,
          correct: attemptStats.correct,
          accuracy:
            attemptStats.attempts >= CATEGORY_ACCURACY_MIN_ATTEMPTS
              ? Math.round((attemptStats.correct / attemptStats.attempts) * 100)
              : null,
          dueCount: mistakeStats.due,
          masteredCount: mistakeStats.mastered,
          trackedCount: mistakeStats.tracked,
        }
      })

    const subjectAttempts = attemptStatsBySubject.get(subject.id) ?? { attempts: 0, correct: 0 }

    return {
      subjectId: subject.id,
      name: subject.name,
      slug: subject.slug,
      description: subject.description,
      questionCount: questionCountBySubject.get(subject.id) ?? 0,
      attempts: subjectAttempts.attempts,
      accuracy:
        subjectAttempts.attempts >= CATEGORY_ACCURACY_MIN_ATTEMPTS
          ? Math.round((subjectAttempts.correct / subjectAttempts.attempts) * 100)
          : null,
      dueCount: dueBySubject.get(subject.id) ?? 0,
      categories,
    }
  })
}
