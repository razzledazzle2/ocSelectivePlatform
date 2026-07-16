import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'

export default function AdminBlueprintDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-4 w-28" />
        </div>
        <PageHeaderSkeleton />
      </div>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full sm:col-span-2" />
            <Skeleton className="h-16 w-full sm:col-span-2" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}
