import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

function BarRowSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Skeleton className={`h-3 ${labelWidth}`} />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

export default function SubtopicMasteryLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <PageHeaderSkeleton withActions />

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <StatGridSkeleton count={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="space-y-3">
            <BarRowSkeleton labelWidth="w-12" />
            <BarRowSkeleton labelWidth="w-16" />
            <BarRowSkeleton labelWidth="w-12" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          <BarRowSkeleton labelWidth="w-32" />
          <BarRowSkeleton labelWidth="w-24" />
          <BarRowSkeleton labelWidth="w-28" />
        </CardContent>
      </Card>

      <TableSkeleton columns={['Question', 'Skill', 'Result', 'When']} rows={5} title />
    </div>
  )
}
