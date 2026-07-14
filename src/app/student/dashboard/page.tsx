import { StudentDashboardOverview } from '@/components/student/student-dashboard-overview'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardData } from '@/lib/dashboard/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function StudentDashboardPage() {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const data = await getStudentDashboardData(profile.id)

  return <StudentDashboardOverview profile={profile} data={data} />
}
