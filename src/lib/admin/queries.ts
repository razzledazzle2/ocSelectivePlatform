import { createClient } from '@/lib/supabase/server'
import type { AdminDashboardStats, AdminStudentRow, AppRole } from '@/lib/types'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  role: AppRole
  year_level: number | null
  target_exam: string | null
  school: string | null
  created_at: string
}

interface AttemptRow {
  student_id: string
  is_correct: boolean
  attempted_at: string
}

interface MistakeRow {
  student_id: string
  status: string
}

function buildStudentRows(
  profiles: ProfileRow[],
  attempts: AttemptRow[],
  mistakes: MistakeRow[]
): AdminStudentRow[] {
  const attemptsByStudent = new Map<string, AttemptRow[]>()
  const activeMistakesByStudent = new Map<string, number>()

  for (const attempt of attempts) {
    const existing = attemptsByStudent.get(attempt.student_id) ?? []
    existing.push(attempt)
    attemptsByStudent.set(attempt.student_id, existing)
  }

  for (const mistake of mistakes) {
    if (mistake.status !== 'needs_review' && mistake.status !== 'reviewing') {
      continue
    }

    activeMistakesByStudent.set(
      mistake.student_id,
      (activeMistakesByStudent.get(mistake.student_id) ?? 0) + 1
    )
  }

  return profiles.map((profile) => {
    const studentAttempts = attemptsByStudent.get(profile.id) ?? []
    const questionsCompleted = studentAttempts.length
    const correctAnswers = studentAttempts.filter((attempt) => attempt.is_correct).length
    const incorrectAnswers = questionsCompleted - correctAnswers
    const accuracy =
      questionsCompleted > 0
        ? Number(((correctAnswers / questionsCompleted) * 100).toFixed(1))
        : null
    const latestAttemptAt =
      studentAttempts
        .map((attempt) => attempt.attempted_at)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      yearLevel: profile.year_level,
      targetExam: profile.target_exam,
      school: profile.school,
      createdAt: profile.created_at,
      questionsCompleted,
      correctAnswers,
      incorrectAnswers,
      accuracy,
      activeMistakes: activeMistakesByStudent.get(profile.id) ?? 0,
      latestAttemptAt,
    }
  })
}

export async function getAdminStudentRows(limit = 100): Promise<AdminStudentRow[]> {
  const supabase = createClient()
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, year_level, target_exam, school, created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (profilesError) {
    throw new Error('Unable to load student profiles.')
  }

  const studentProfiles = (profiles ?? []) as ProfileRow[]
  const studentIds = studentProfiles.map((profile) => profile.id)

  if (!studentIds.length) {
    return []
  }

  const [{ data: attempts, error: attemptsError }, { data: mistakes, error: mistakesError }] =
    await Promise.all([
      supabase
        .from('question_attempts')
        .select('student_id, is_correct, attempted_at')
        .in('student_id', studentIds),
      supabase
        .from('student_mistake_questions')
        .select('student_id, status')
        .in('student_id', studentIds),
    ])

  if (attemptsError || mistakesError) {
    throw new Error('Unable to load student progress data.')
  }

  return buildStudentRows(
    studentProfiles,
    (attempts ?? []) as AttemptRow[],
    (mistakes ?? []) as MistakeRow[]
  )
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient()
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalStudents, error: studentCountError },
    { count: totalStaff, error: staffCountError },
    { count: totalQuestions, error: questionCountError },
    { count: publishedQuestions, error: publishedError },
    { count: draftQuestions, error: draftError },
    { count: archivedQuestions, error: archivedError },
    { count: attemptsLast7Days, error: attemptsError },
    { count: activeMistakes, error: mistakesError },
    recentStudents,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['tutor', 'admin', 'super_admin']),
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'archived'),
    supabase
      .from('question_attempts')
      .select('id', { count: 'exact', head: true })
      .gte('attempted_at', last7Days),
    supabase
      .from('student_mistake_questions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['needs_review', 'reviewing']),
    getAdminStudentRows(6),
  ])

  if (
    studentCountError ||
    staffCountError ||
    questionCountError ||
    publishedError ||
    draftError ||
    archivedError ||
    attemptsError ||
    mistakesError
  ) {
    throw new Error('Unable to load the admin dashboard right now.')
  }

  return {
    totalStudents: totalStudents ?? 0,
    totalStaff: totalStaff ?? 0,
    totalQuestions: totalQuestions ?? 0,
    publishedQuestions: publishedQuestions ?? 0,
    draftQuestions: draftQuestions ?? 0,
    archivedQuestions: archivedQuestions ?? 0,
    attemptsLast7Days: attemptsLast7Days ?? 0,
    activeMistakes: activeMistakes ?? 0,
    recentStudents,
  }
}
