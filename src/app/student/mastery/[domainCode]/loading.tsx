import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, StatGridSkeleton } from '@/components/ui/loading-primitives'

function SubtopicRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-8 w-20 shrink-0" />
    </div>
  )
}

export default function DomainMasteryLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <PageHeaderSkeleton />

      <StatGridSkeleton count={4} />

      <Card className="rounded-2xl">
        <CardContent className="divide-y divide-border p-0 px-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <SubtopicRowSkeleton key={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
