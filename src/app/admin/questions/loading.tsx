import { Skeleton } from '@/components/ui/skeleton'

/** Route-level loading state for the paginated question bank. */
export default function AdminQuestionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="items-start gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl px-3 py-3">
                <Skeleton className="mt-1 size-4 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border px-3 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-8 w-56" />
            </div>
          </div>
        </div>

        <div className="hidden space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
