import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** Mirrors PageHeader: eyebrow / title / description skeleton lines. */
export function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {withActions ? (
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      ) : null}
    </div>
  )
}

/** Mirrors StatCard: label / big value / hint with a tinted icon chip. */
export function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-xl" />
      </CardContent>
    </Card>
  )
}

/** Grid of StatCardSkeletons, defaults to the common 4-up dashboard layout. */
export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  )
}

interface TableSkeletonProps {
  /** Real column header labels so the header row never blanks out during loading. */
  columns: string[]
  rows?: number
  title?: boolean
}

/** Table with real headers preserved and skeleton cells in place of row data. */
export function TableSkeleton({ columns, rows = 6, title = false }: TableSkeletonProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      {title ? (
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
      ) : null}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={column}>
                    <Skeleton className={cn('h-4', columnIndex === 0 ? 'w-32' : 'w-16')} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** Avatar + name/subtitle + trailing metric row, for people/entity lists. */
export function AvatarListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-4 w-14 shrink-0" />
    </div>
  )
}

export function AvatarListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-border/70', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <AvatarListRowSkeleton key={index} />
      ))}
    </div>
  )
}

/** Generic bordered card body, for freeform panels (question rows, mock cards, etc). */
export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <Card className={cn('rounded-2xl border border-border shadow-card', className)}>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn('h-4', index === 0 ? 'w-2/3' : 'w-full')} />
        ))}
      </CardContent>
    </Card>
  )
}

/** Placeholder for a chart/graph area, reserving its final aspect ratio. */
export function ChartSkeleton({ className, height = 'h-64' }: { className?: string; height?: string }) {
  return (
    <Card className={cn('rounded-2xl border border-border shadow-card', className)}>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className={cn('w-full rounded-xl', height)} />
      </CardContent>
    </Card>
  )
}

/** Row of filter controls (search box + N selects), matching typical filter bars. */
export function FilterBarSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: fields }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  )
}

/** Wraps a page in the standard header + content vertical rhythm used across routes. */
export function PageSkeleton({ withActions = false, children }: { withActions?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions={withActions} />
      {children}
    </div>
  )
}
