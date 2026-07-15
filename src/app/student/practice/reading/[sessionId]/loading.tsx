import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReadingSessionLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Passage */}
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        {/* Question */}
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="size-7 rounded-full" />
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-2xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
