import { PageHeader } from '@/components/layout/page-header'
import { SubjectMasteryOverview, type AvailabilityMap } from '@/components/student/mastery/subject-mastery-overview'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentMasteryOverview } from '@/lib/mastery/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function StudentMasteryPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const { subjects, recommendations, availability, hasAnyAttempts, legacyAttempts } =
    await getStudentMasteryOverview(profile.id)

  const availabilityMap: AvailabilityMap = Object.fromEntries(availability)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your mastery"
        title="Subtopic mastery"
        description="Every subtopic you can be examined on, and how solid you are on each. Mastery grows with accuracy across varied questions — not with the number you answer."
      />

      <SubjectMasteryOverview
        subjects={subjects}
        recommendations={recommendations}
        availability={availabilityMap}
        hasAnyAttempts={hasAnyAttempts}
      />

      {legacyAttempts > 0 ? (
        <p className="text-xs text-muted-foreground">
          {legacyAttempts} earlier {legacyAttempts === 1 ? 'answer' : 'answers'} came from before subtopics were
          introduced, so {legacyAttempts === 1 ? 'it is' : 'they are'} not counted here. Your practice history is
          unchanged.
        </p>
      ) : null}
    </div>
  )
}
