import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AvatarListSkeleton,
  PageHeaderSkeleton,
  StatGridSkeleton,
} from '@/components/ui/loading-primitives'

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <StatGridSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-2xl border border-border shadow-card">
          <CardHeader className="border-b border-border/70">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="pt-6">
            <AvatarListSkeleton count={5} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-card">
          <CardHeader className="border-b border-border/70">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-8 w-16" />
                <Skeleton className="mt-2 h-4 w-48 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
