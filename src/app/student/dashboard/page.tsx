import { StudentDashboardOverview } from '@/components/student/student-dashboard-overview'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardStats } from '@/lib/dashboard/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function StudentDashboardPage() {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const stats = await getStudentDashboardStats(profile.id)

  return <StudentDashboardOverview profile={profile} stats={stats} />
}
