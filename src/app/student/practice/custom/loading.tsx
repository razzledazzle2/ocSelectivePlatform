import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function CustomPracticeLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-36" />
      <PageHeaderSkeleton />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border border-border shadow-card">
            <CardHeader className="border-b border-border/70">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
