import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

const QUESTION_COLUMNS = ['Question', 'Difficulty', 'Status', 'Pattern', 'Asset', 'Validation']

export default function AdminCoverageSubtopicLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>

      <StatGridSkeleton count={4} />

      <div className="grid gap-4 lg:grid-cols-3">
        {['Difficulty distribution', 'Question statuses', 'Asset issues'].map((title) => (
          <Card key={title} className="rounded-2xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {['Skills represented', 'Pattern keys represented'].map((title) => (
          <Card key={title} className="rounded-2xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-16 rounded-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <TableSkeleton columns={QUESTION_COLUMNS} rows={8} />
      </div>
    </div>
  )
}
