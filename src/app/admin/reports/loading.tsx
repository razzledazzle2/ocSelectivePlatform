import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

export default function AdminReportsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl shadow-sm ring-border">
            <CardContent className="px-4 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      <TableSkeleton
        columns={['Reported question', 'Type', 'Reports', 'Report status', 'Assigned', 'Created', 'Resolved', 'Actions']}
      />
    </div>
  )
}
