import Link from 'next/link'
import { DatabaseIcon, LayoutTemplateIcon, UploadIcon } from 'lucide-react'

import { MockList } from '@/components/admin/mocks/mock-list'
import { MockProgramCoveragePanel } from '@/components/admin/mocks/mock-program-coverage'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMockProgramCoverage, getMockTests } from '@/lib/mock-tests/queries'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'
import type { MockProgramCoverage, MockTestListItem } from '@/lib/mock-tests/types'
import { cn } from '@/lib/utils'

export default async function AdminMocksPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  // Mock tests live in tables added by the admin_curated_mock_tests migration;
  // until it is pushed the query fails, so show setup guidance instead of a crash.
  let mocks: MockTestListItem[] | null = null
  let programCoverage: MockProgramCoverage | null = null
  try {
    ;[mocks, programCoverage] = await Promise.all([getMockTests(), getMockProgramCoverage()])
  } catch {
    mocks = null
    programCoverage = null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam preparation"
        title="Mock Tests"
        description="Curated, sectioned mock exams built from the question bank — Reading, Mathematical Reasoning, Thinking Skills and Writing with timed breaks."
        actions={
          <>
            <Link href="/admin/mocks/blueprints" className={cn(buttonVariants({ variant: 'outline' }))}>
              <LayoutTemplateIcon className="size-4" />
              Blueprints
            </Link>
            <Link href="/admin/mocks/import" className={cn(buttonVariants({ variant: 'default' }))}>
              <UploadIcon className="size-4" />
              Import from CSV
            </Link>
          </>
        }
      />
      {mocks === null ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <DatabaseIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">Mock test tables are not set up yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Apply the pending <code className="rounded bg-muted px-1 py-0.5 text-xs">admin_curated_mock_tests</code>{' '}
            migration with <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase db push</code>, then reload
            this page.
          </p>
        </div>
      ) : (
        <>
          <MockList mocks={mocks} />
          {programCoverage ? <MockProgramCoveragePanel initial={programCoverage} /> : null}
        </>
      )}
    </div>
  )
}
