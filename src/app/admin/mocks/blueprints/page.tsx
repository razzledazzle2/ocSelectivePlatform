import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMockBlueprints } from '@/lib/mock-blueprints/queries'
import type { MockBlueprintListItem } from '@/lib/mock-blueprints/types'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export default async function AdminBlueprintsPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  let blueprints: MockBlueprintListItem[] | null = null
  try {
    blueprints = await getMockBlueprints()
  } catch {
    blueprints = null
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
          title="Mock blueprints"
          description="Deterministic, rule-based targets for building and checking mocks — domain/difficulty spread, required subtopics, pattern variety and answer balance. No AI."
          actions={
            <Link href="/admin/mocks/blueprints/new" className={cn(buttonVariants({ variant: 'default' }))}>
              <PlusIcon className="size-4" />
              New blueprint
            </Link>
          }
        />
      </div>

      {blueprints === null ? (
        <EmptyState title="Blueprint tables are not set up yet" description="Push the mock_blueprints migration, then reload." />
      ) : blueprints.length === 0 ? (
        <EmptyState
          title="No blueprints yet"
          description="Create a blueprint to auto-build mocks from the bank and validate imported mocks."
          action={
            <Link href="/admin/mocks/blueprints/new" className={cn(buttonVariants({ variant: 'default' }))}>
              <PlusIcon className="size-4" />
              New blueprint
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Exam</th>
                  <th className="px-4 py-2.5">Target</th>
                  <th className="px-4 py-2.5">Rules</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {blueprints.map((blueprint) => (
                  <tr key={blueprint.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/mocks/blueprints/${blueprint.id}`} className="font-medium text-brand hover:underline">
                        {blueprint.title}
                      </Link>
                      {blueprint.description ? (
                        <p className="max-w-md truncate text-xs text-muted-foreground">{blueprint.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{blueprint.subjectCode ?? 'Any'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{blueprint.examType ?? 'Any'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{blueprint.targetTotal ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{blueprint.ruleCount}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={blueprint.status === 'active' ? 'default' : 'outline'}>{blueprint.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
