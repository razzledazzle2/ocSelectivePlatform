'use client'

import { Fragment, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AssetPreviewState, ImportRowAction, ImportRowStatus, ValidatedImportRow } from '@/lib/import/types'

interface ImportPreviewTableProps {
  rows: ValidatedImportRow[]
}

function StatusBadge({ status }: { status: ImportRowStatus }) {
  if (status === 'error') {
    return <Badge variant="destructive">Error</Badge>
  }
  if (status === 'warning') {
    return (
      <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
        Ready with warnings
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-transparent bg-success-soft text-success">
      Ready
    </Badge>
  )
}

const ACTION_LABELS: Record<ImportRowAction, string> = {
  create: 'Create',
  update: 'Update',
  unchanged: 'Unchanged',
  skip_duplicate: 'Duplicate (skipped)',
}

const ACTION_CLASSES: Record<ImportRowAction, string> = {
  create: 'border-transparent bg-brand-soft text-brand',
  update: 'border-transparent bg-warning-soft text-warning',
  unchanged: 'border-transparent bg-muted text-muted-foreground',
  skip_duplicate: 'border-transparent bg-muted text-muted-foreground',
}

function ActionBadge({ action }: { action: ImportRowAction }) {
  return (
    <Badge variant="outline" className={ACTION_CLASSES[action]}>
      {ACTION_LABELS[action]}
    </Badge>
  )
}

const ASSET_STATE_LABELS: Record<AssetPreviewState, string> = {
  not_required: 'Not required',
  ready: 'Ready',
  pending: 'Pending',
  missing: 'Missing',
  invalid: 'Invalid',
  rejected: 'Rejected',
}

const ASSET_STATE_CLASSES: Record<AssetPreviewState, string> = {
  not_required: 'border-transparent bg-muted text-muted-foreground',
  ready: 'border-transparent bg-success-soft text-success',
  pending: 'border-transparent bg-warning-soft text-warning',
  missing: 'border-transparent bg-destructive/10 text-destructive',
  invalid: 'border-transparent bg-destructive/10 text-destructive',
  rejected: 'border-transparent bg-destructive/10 text-destructive',
}

/** Worst asset state across a row's refs, for a single summary badge in the table cell. */
const ASSET_STATE_SEVERITY: AssetPreviewState[] = ['invalid', 'missing', 'rejected', 'pending', 'ready', 'not_required']

function AssetStateBadge({ row }: { row: ValidatedImportRow }) {
  if (row.assetPreviews.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const worst = ASSET_STATE_SEVERITY.find((state) => row.assetPreviews.some((preview) => preview.state === state)) ?? 'ready'
  const count = row.assetPreviews.length
  return (
    <Badge variant="outline" className={ASSET_STATE_CLASSES[worst]}>
      {ASSET_STATE_LABELS[worst]}
      {count > 1 ? ` (${count})` : ''}
    </Badge>
  )
}

function RowDetails({ row }: { row: ValidatedImportRow }) {
  const changedDiffs = row.diffs.filter((diff) => diff.changed)

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
      {changedDiffs.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground">Changes</p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pr-3 py-1 font-medium">Field</th>
                  <th className="pr-3 py-1 font-medium">Existing</th>
                  <th className="pr-3 py-1 font-medium">Incoming</th>
                  <th className="py-1 font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {changedDiffs.map((diff) => (
                  <tr key={diff.field} className="align-top border-t border-border/50">
                    <td className="pr-3 py-1 font-medium text-foreground">{diff.label}</td>
                    <td className="pr-3 py-1 text-muted-foreground line-clamp-2">{diff.existing || '—'}</td>
                    <td className="pr-3 py-1 text-muted-foreground line-clamp-2">{diff.incoming || '—'}</td>
                    <td className="py-1 text-foreground line-clamp-2">{diff.final || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {row.assetPreviews.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground">Assets</p>
          <ul className="mt-1 space-y-1">
            {row.assetPreviews.map((preview, index) => (
              <li key={`${preview.field}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className={ASSET_STATE_CLASSES[preview.state]}>
                  {ASSET_STATE_LABELS[preview.state]}
                </Badge>
                <span className="text-muted-foreground">{preview.field}:</span>
                <span className="font-mono text-foreground">{preview.ref}</span>
                {preview.message ? <span className="text-muted-foreground">— {preview.message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {changedDiffs.length === 0 && row.assetPreviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">No changes or asset refs to show.</p>
      ) : null}
    </div>
  )
}

export function ImportPreviewTable({ rows }: ImportPreviewTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggle(rowNumber: number) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(rowNumber)) {
        next.delete(rowNumber)
      } else {
        next.add(rowNumber)
      }
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="max-h-[28rem] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-12">#</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="min-w-[16rem]">Question</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead className="text-center">Options</TableHead>
              <TableHead className="text-center">Correct</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="min-w-[16rem]">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const canExpand = row.diffs.some((diff) => diff.changed) || row.assetPreviews.length > 0
              const isExpanded = expanded.has(row.rowNumber)

              return (
                <Fragment key={row.rowNumber}>
                  <TableRow>
                    <TableCell className="align-top">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => toggle(row.rowNumber)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">{row.rowNumber}</TableCell>
                    <TableCell className="align-top">
                      <StatusBadge status={row.rowStatus} />
                    </TableCell>
                    <TableCell className="align-top">
                      <ActionBadge action={row.action} />
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="line-clamp-2 text-sm text-foreground">{row.questionPreview}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.questionTypeLabel} • imports as {row.statusLabel}
                      </p>
                    </TableCell>
                    <TableCell className="align-top text-sm">{row.subjectLabel}</TableCell>
                    <TableCell className="align-top text-sm">{row.topicLabel}</TableCell>
                    <TableCell className="align-top text-center text-sm">{row.optionsCount}</TableCell>
                    <TableCell className="align-top text-center">
                      <Badge variant="outline">{row.correctAnswerLabel}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <AssetStateBadge row={row} />
                    </TableCell>
                    <TableCell className="align-top">
                      {row.errors.length === 0 && row.warnings.length === 0 ? (
                        <p className="text-sm text-emerald-700">Ready to import</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {row.errors.map((issue, index) => (
                            <li key={`e-${index}`} className="text-destructive">
                              {issue.message}
                            </li>
                          ))}
                          {row.warnings.map((issue, index) => (
                            <li key={`w-${index}`} className="text-amber-700">
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={11} className="bg-muted/20 p-3">
                        <RowDetails row={row} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
