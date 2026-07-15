import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReadingSetupLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
          <Skeleton className="h-9 w-48" />
        </CardContent>
      </Card>
    </div>
  )
}
