import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function MockExamRunnerLoading() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Exam in progress</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Preparing your exam…</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Loading your questions and starting the timer. This will only take a moment.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-24 rounded-xl" />
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <div className="min-w-0 space-y-5">
              <div className="space-y-2">
                <Skeleton className="h-3 w-40" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>

            <aside className="space-y-4 lg:border-l lg:border-border/70 lg:pl-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Questions
                </p>
              </div>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
                {Array.from({ length: 15 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-9 w-full" />
            </aside>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
