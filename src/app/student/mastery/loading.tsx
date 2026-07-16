import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'

export default function StudentMasteryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <Card className="rounded-2xl border border-border shadow-card">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <Skeleton className="size-[120px] rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="mx-auto h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mx-auto h-3 w-3/4" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border border-border shadow-card">
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
      </div>

      <section className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border border-border shadow-card">
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border border-border shadow-card">
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
