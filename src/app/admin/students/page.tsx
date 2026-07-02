import { AdminStudentTable } from '@/components/admin/admin-student-table'
import { getAdminStudentRows } from '@/lib/admin/queries'

export default async function AdminStudentsPage() {
  const students = await getAdminStudentRows()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Student operations</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Students</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Monitor enrolment, recent practice activity, and revision pressure without leaving the admin area.
        </p>
      </div>

      <AdminStudentTable students={students} />
    </div>
  )
}
