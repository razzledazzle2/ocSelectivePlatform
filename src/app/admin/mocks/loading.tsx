import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

const MOCK_LIST_COLUMNS = [
  'Mock test',
  'Status',
  'Exam',
  'Questions',
  'Duration',
  'Attempts',
  'Avg score',
  'Order',
  'Updated',
  'Actions',
]

export default function AdminMocksLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>

      <TableSkeleton columns={MOCK_LIST_COLUMNS} rows={6} />

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-44" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-8 w-14" />
              </div>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 5 }).map((__, badgeIndex) => (
                    <Skeleton key={badgeIndex} className="h-5 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Skeleton className="h-3 w-48" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
