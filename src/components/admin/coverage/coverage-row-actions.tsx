'use client'

import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReferenceExportScope } from '@/app/admin/coverage/actions'
import { BlankTemplateButton } from './blank-template-button'
import { ReferenceExportDialog } from './reference-export-dialog'

/**
 * The action set for a coverage row: open the matching questions in the Question
 * Bank (deep-linked filters), export a reference CSV, and download the blank
 * import template. No "Generate" — this dashboard never triggers AI.
 */
export function CoverageRowActions({
  bankHref,
  scope,
  includeTemplate = false,
}: {
  bankHref: string
  scope: ReferenceExportScope
  includeTemplate?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={bankHref} className={cn(buttonVariants({ variant: 'outline' }))}>
        <ExternalLinkIcon className="size-4" />
        Open in Question Bank
      </Link>
      <ReferenceExportDialog scope={scope} />
      {includeTemplate ? <BlankTemplateButton /> : null}
    </div>
  )
}
