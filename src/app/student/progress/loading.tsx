import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

function AreaCardSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardContent>
    </Card>
  )
}

export default function StudentProgressLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>

      <Skeleton className="h-9 w-72 rounded-lg" />

      <StatGridSkeleton count={4} />

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <TableSkeleton columns={['Area', 'Attempted', 'Accuracy', 'Practise']} rows={4} title />

      <div className="grid gap-4 md:grid-cols-2">
        <AreaCardSkeleton />
        <AreaCardSkeleton />
      </div>

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>

      <TableSkeleton columns={['Date', 'Focus', 'Questions', 'Accuracy']} rows={6} title />
    </div>
  )
}
