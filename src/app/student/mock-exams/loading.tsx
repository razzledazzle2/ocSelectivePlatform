import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Skeleton } from '@/components/ui/skeleton'

function MockRowSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-2/3 max-w-md" />
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <Skeleton className="h-9 w-24 shrink-0" />
    </div>
  )
}

export default function StudentMockExamsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <MockRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
