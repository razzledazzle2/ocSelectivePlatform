import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

export default function StudentDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>

      <StatGridSkeleton count={4} />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5">
                {Array.from({ length: 14 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square w-full rounded-md" />
                ))}
              </div>
            </CardContent>
          </Card>

          <TableSkeleton columns={['Date', 'Focus', 'Questions', 'Accuracy']} rows={5} title />
        </div>

        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
