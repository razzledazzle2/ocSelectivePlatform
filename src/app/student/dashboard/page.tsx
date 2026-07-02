import { StudentStatsCards } from '@/components/dashboard/student-stats-cards'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardStats } from '@/lib/dashboard/queries'

export default async function StudentDashboardPage() {
  const profile = await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })
  const stats = await getStudentDashboardStats(profile.id)

  return <StudentStatsCards stats={stats} />
}
