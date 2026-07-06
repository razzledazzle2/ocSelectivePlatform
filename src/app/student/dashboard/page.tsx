import { StudentDashboardOverview } from '@/components/student/student-dashboard-overview'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardData } from '@/lib/dashboard/queries'
import { getRecentMockExams } from '@/lib/mock-exams/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function StudentDashboardPage() {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const [data, recentMocks] = await Promise.all([
    getStudentDashboardData(profile.id),
    getRecentMockExams(profile.id, 3),
  ])

  return <StudentDashboardOverview profile={profile} data={data} recentMocks={recentMocks} />
}
