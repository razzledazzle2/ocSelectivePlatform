import { PageHeader } from '@/components/layout/page-header'
import { CuratedMockList } from '@/components/student/mock-exams/curated-mock-list'
import { requireProfile } from '@/lib/auth/require-profile'
import { getPublishedMocksForStudent } from '@/lib/mock-tests/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import type { StudentMockListItem } from '@/lib/mock-tests/types'

export default async function StudentMockExamsPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  // Mock tests live in tables added by the curated-mock migrations; until they
  // are pushed the query fails, so degrade to an empty list rather than a crash.
  let mocks: StudentMockListItem[] = []
  try {
    mocks = await getPublishedMocksForStudent(profile.id)
  } catch {
    mocks = []
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mock Tests"
        title="Mock Tests"
        description="Complete full-length practice tests created by your tutors. Every question you miss flows into Smart Revision."
      />

      <CuratedMockList mocks={mocks} />
    </div>
  )
}
