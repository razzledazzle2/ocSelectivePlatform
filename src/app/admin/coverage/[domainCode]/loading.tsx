import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

const COLUMNS = ['Subtopic', 'Status', 'Usable', 'Patterns', 'Asset-ready', 'Missing', 'Difficulty']

export default function AdminCoverageDomainLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>

      <StatGridSkeleton count={4} />

      <TableSkeleton columns={COLUMNS} rows={8} />
    </div>
  )
}
