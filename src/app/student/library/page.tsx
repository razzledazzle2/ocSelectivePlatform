import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { SkillLibrary } from '@/components/student/skill-library'
import { buttonVariants } from '@/components/ui/button'
import { requireProfile } from '@/lib/auth/require-profile'
import { getSkillLibraryData } from '@/lib/library/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export default async function SkillLibraryPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const subjects = await getSkillLibraryData(profile.id)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Skill Library"
        title="Choose a skill to master"
        description="Browse every question type by subject, see how you are tracking, and practise exactly what you need."
        actions={
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'outline' }))}>
            Quick practice
          </Link>
        }
      />
      <SkillLibrary subjects={subjects} />
    </div>
  )
}
