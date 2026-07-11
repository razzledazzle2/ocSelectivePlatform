import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

const BLUEPRINT_COLUMNS = ['Title', 'Subject', 'Exam', 'Target', 'Rules', 'Status']

export default function AdminBlueprintsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-4 w-28" />
        </div>
        <PageHeaderSkeleton withActions />
      </div>

      <TableSkeleton columns={BLUEPRINT_COLUMNS} rows={6} />
    </div>
  )
}
