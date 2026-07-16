import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TableSkeleton } from '@/components/ui/loading-primitives'
import { Skeleton } from '@/components/ui/skeleton'

function MetricBoxSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-6 w-12" />
    </div>
  )
}

export default function MockExamResultsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 py-6">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <MetricBoxSkeleton key={index} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-14" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-4"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-8 w-28 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <TableSkeleton
          columns={['Subject', 'Answered', 'Correct', 'Incorrect', 'Accuracy']}
          rows={5}
          title
        />
      </div>
    </div>
  )
}
