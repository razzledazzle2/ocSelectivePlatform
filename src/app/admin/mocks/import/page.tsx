import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { MockImportPanel } from '@/components/admin/mocks/mock-import-panel'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { getActiveBlueprints } from '@/lib/mock-blueprints/queries'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

export default async function AdminMockImportPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  // Blueprint tables may not exist until the migration is pushed — degrade gracefully.
  let blueprints: Array<{ id: string; title: string }> = []
  try {
    blueprints = (await getActiveBlueprints()).map((blueprint) => ({ id: blueprint.id, title: blueprint.title }))
  } catch {
    blueprints = []
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/mocks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All mock tests
        </Link>
        <PageHeader
          eyebrow="Exam preparation"
          title="Import a mock from CSV"
          description="Build a whole mock externally — including brand-new questions — then upload, validate, preview and import it as a draft. New questions can stay mock-only or be added to the question bank."
        />
      </div>

      <MockImportPanel blueprints={blueprints} />
    </div>
  )
}
