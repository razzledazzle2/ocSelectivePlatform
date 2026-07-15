import Link from 'next/link'
import { BookOpenIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { ReadingPracticeSetup } from '@/components/student/reading-practice-setup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { requireProfile } from '@/lib/auth/require-profile'
import { buildReadingPracticeChoices } from '@/lib/question-sets/core'
import { getAvailableReadingSets } from '@/lib/question-sets/queries'
import { getSubjects } from '@/lib/questions/queries'
import { getActiveProgram, isExamType } from '@/lib/student-program/program'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Rough per-question pace used for the time estimate on the setup screen. */
const SECONDS_PER_QUESTION = 75

interface ReadingPracticePageProps {
  searchParams: Promise<{ subjectId?: string; examType?: string }>
}

export default async function ReadingPracticePage({ searchParams }: ReadingPracticePageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const params = await searchParams

  const examType = isExamType(params.examType) ? params.examType : await getActiveProgram(profile.id)

  const subjects = await getSubjects()
  const readingSubject =
    (params.subjectId && subjects.find((subject) => subject.id === params.subjectId)) ||
    subjects.find(
      (subject) =>
        subject.name.toLowerCase().includes('reading') || subject.slug.toLowerCase().includes('reading')
    )

  const backHref = '/student/practice'

  if (!readingSubject) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Reading practice" title="Reading passages" />
        <EmptyState
          icon={BookOpenIcon}
          title="No reading subject found"
          description="Reading practice becomes available once a Reading subject with published passage sets exists."
          action={
            <Link className={buttonVariants({ variant: 'outline' })} href={backHref}>
              Back to practice
            </Link>
          }
        />
      </div>
    )
  }

  const sets = await getAvailableReadingSets(examType, readingSubject.id)

  const choices = buildReadingPracticeChoices(
    sets.map((set) => set.questionCount),
    SECONDS_PER_QUESTION
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${examType} · Reading`}
        title="Reading passages"
        description="Choose how many passage sets to work through. Each set keeps its passage on screen while you answer, and grades every question together when you submit."
        actions={
          <Link className={buttonVariants({ variant: 'ghost' })} href={backHref}>
            Back to practice
          </Link>
        }
      />

      {choices.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No reading sets published yet"
          description={`There are no ${examType} reading passage sets available for ${readingSubject.name} yet. Check back once some have been published.`}
          action={
            <Link className={buttonVariants({ variant: 'outline' })} href={backHref}>
              Back to practice
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>How much do you want to read today?</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadingPracticeSetup examType={examType} subjectId={readingSubject.id} choices={choices} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
