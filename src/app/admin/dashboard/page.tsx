import { AdminDashboardOverview } from '@/components/admin/admin-dashboard-overview'
import { getAdminDashboardStats } from '@/lib/admin/queries'

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats()

  return <AdminDashboardOverview stats={stats} />
}
