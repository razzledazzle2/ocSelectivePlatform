import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getImportBatches, type ImportBatchFinalStatus } from '@/lib/import/history'
import type { ImportMode } from '@/lib/import/types'
import { cn } from '@/lib/utils'

const MODE_LABELS: Record<ImportMode, string> = {
  create: 'Create new only',
  update: 'Update matching only',
  create_and_update: 'Create & update',
}

const STATUS_CLASSES: Record<ImportBatchFinalStatus, string> = {
  completed: 'border-transparent bg-success-soft text-success',
  completed_with_errors: 'border-transparent bg-warning-soft text-warning',
  failed: 'border-transparent bg-destructive/10 text-destructive',
}

const STATUS_LABELS: Record<ImportBatchFinalStatus, string> = {
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  failed: 'Failed',
}

export default async function ImportHistoryPage() {
  const batches = await getImportBatches()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content workflow"
        title="Import history"
        description="Every CSV/paste/zip import run — filename, mode, and how many questions and assets were created, updated, or rejected."
        actions={
          <Link href="/admin/import" className={cn(buttonVariants({ variant: 'outline' }))}>
            <ArrowLeftIcon className="size-4" />
            Back to import
          </Link>
        }
      />

      {batches.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
          No imports have been run yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead className="text-center">Created</TableHead>
                  <TableHead className="text-center">Updated</TableHead>
                  <TableHead className="text-center">Unchanged</TableHead>
                  <TableHead className="text-center">Rejected</TableHead>
                  <TableHead className="text-center">Assets uploaded</TableHead>
                  <TableHead className="text-center">Assets rejected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(batch.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{batch.filename}</TableCell>
                    <TableCell className="text-sm">{MODE_LABELS[batch.importMode]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{batch.uploadedByName ?? '—'}</TableCell>
                    <TableCell className="text-center text-sm">{batch.questionsCreated}</TableCell>
                    <TableCell className="text-center text-sm">{batch.questionsUpdated}</TableCell>
                    <TableCell className="text-center text-sm">{batch.questionsUnchanged}</TableCell>
                    <TableCell className="text-center text-sm">{batch.questionsRejected}</TableCell>
                    <TableCell className="text-center text-sm">{batch.assetsUploaded}</TableCell>
                    <TableCell className="text-center text-sm">{batch.assetsRejected}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASSES[batch.finalStatus]}>
                        {STATUS_LABELS[batch.finalStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
