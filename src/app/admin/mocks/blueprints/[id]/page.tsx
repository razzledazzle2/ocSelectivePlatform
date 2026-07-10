import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { BlueprintEditor } from '@/components/admin/mocks/blueprint-editor'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMockBlueprintById } from '@/lib/mock-blueprints/queries'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

interface BlueprintDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function BlueprintDetailPage({ params }: BlueprintDetailPageProps) {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { id } = await params

  const blueprint = await getMockBlueprintById(id)
  if (!blueprint) {
    notFound()
  }

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
        <PageHeader eyebrow="Exam preparation" title={blueprint.title} description={blueprint.description ?? undefined} />
      </div>
      <BlueprintEditor blueprint={blueprint} />
    </div>
  )
}
