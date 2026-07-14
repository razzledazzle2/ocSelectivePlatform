import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function LearnPracticeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* Recommended hero */}
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-start gap-4">
            <Skeleton className="size-11 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-40 shrink-0" />
        </CardContent>
      </Card>

      {/* Subject tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-40 rounded-xl" />
        ))}
      </div>

      {/* Progress summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl shadow-sm ring-border">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-9 shrink-0 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Domain grid */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="rounded-2xl shadow-sm ring-border">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="size-4 shrink-0" />
                </div>
                <Skeleton className="h-3 w-40" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
