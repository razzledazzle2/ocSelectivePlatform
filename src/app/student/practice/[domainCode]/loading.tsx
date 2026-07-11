import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function LearnDomainLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <PageHeaderSkeleton />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl shadow-sm ring-border">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-14" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-5 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-64 max-w-full rounded-full" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-20 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
