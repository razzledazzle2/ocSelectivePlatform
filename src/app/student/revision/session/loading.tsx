import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function StudentRevisionSessionLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="space-y-4 border-b border-border/70">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  )
}
