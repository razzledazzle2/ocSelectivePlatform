import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-primitives'

export default function AdminStudentsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <TableSkeleton
        columns={['Student', 'Role', 'Attempts', 'Accuracy', 'Mistakes', 'Last attempt', 'Joined']}
        title
      />
    </div>
  )
}
