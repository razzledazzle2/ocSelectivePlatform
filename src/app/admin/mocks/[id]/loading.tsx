import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/components/ui/loading-primitives'

function SectionCardSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-lg" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
            <Skeleton className="mt-0.5 h-3 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-8 rounded-full" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AdminMockDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-4 w-28" />
        </div>
        <PageHeaderSkeleton />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/70 pb-px">
        {['Builder', 'Coverage', 'Answer key', 'Statistics'].map((label) => (
          <Skeleton key={label} className="h-8 w-24 rounded-t-lg" />
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full sm:col-span-2" />
            <Skeleton className="h-16 w-full sm:col-span-2" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full sm:col-span-2" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-8 w-32" />
          </div>
        </CardContent>
      </Card>

      {Array.from({ length: 4 }).map((_, index) => (
        <SectionCardSkeleton key={index} />
      ))}

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
