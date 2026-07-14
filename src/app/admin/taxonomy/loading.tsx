import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

export default function AdminTaxonomyLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="flex items-center gap-2 rounded-lg bg-muted p-1 w-fit">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-2xl shadow-sm ring-border">
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
        <Card className="rounded-2xl border-dashed shadow-none ring-0">
          <CardContent className="flex flex-col justify-center gap-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-6">
          <TableSkeleton columns={['Category', 'Questions', 'Status', 'Actions']} rows={4} title />
          <TableSkeleton columns={['Question type', 'Category', 'Questions', 'Status', 'Actions']} rows={4} title />
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader className="space-y-2 border-b border-border/70">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader className="border-b border-border/70">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
