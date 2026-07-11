import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarListSkeleton, StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

function CalendarGridSkeleton() {
  return (
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
  )
}

export default function StudentDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4 rounded-3xl border border-border bg-card px-6 py-8 shadow-sm sm:px-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-11 w-44 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>

        <Card className="rounded-3xl shadow-sm ring-border">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Skeleton className="size-[116px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <StatGridSkeleton count={4} />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-24" />
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>

          <CalendarGridSkeleton />

          <TableSkeleton columns={['Date', 'Focus', 'Questions', 'Accuracy']} rows={5} title />
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl bg-brand-soft shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="p-0">
              <AvatarListSkeleton count={3} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
