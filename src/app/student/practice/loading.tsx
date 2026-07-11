import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function StudentPracticeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader className="border-b border-border/70">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-48" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader className="border-b border-border/70">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
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
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-36" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
