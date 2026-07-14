import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { BlueprintEditor } from '@/components/admin/mocks/blueprint-editor'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

export default async function NewBlueprintPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/mocks/blueprints"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All blueprints
        </Link>
        <PageHeader eyebrow="Exam preparation" title="New blueprint" description="Define deterministic targets for building and checking mocks." />
      </div>
      <BlueprintEditor blueprint={null} />
    </div>
  )
}
