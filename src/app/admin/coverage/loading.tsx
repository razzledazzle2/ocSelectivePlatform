import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PageHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/ui/loading-primitives'

const SUBJECT_TABLE_COLUMNS = ['Domain', 'Status', 'Usable', 'Patterns', 'Asset-ready', 'Difficulty', '']
const MASTERY_TABLE_COLUMNS = ['Subtopic', 'Students', 'Avg mastery', 'Mastery states', 'Usable questions']

export default function AdminCoverageLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withActions />

      <SubjectSectionSkeleton />
      <SubjectSectionSkeleton />

      <section className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <StatGridSkeleton count={4} />
        <TableSkeleton columns={MASTERY_TABLE_COLUMNS} rows={6} />
        <div className="grid gap-4 lg:grid-cols-2">
          <HighlightCardSkeleton />
          <HighlightCardSkeleton />
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="rounded-2xl">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-6" />
                </div>
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function SubjectSectionSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <StatGridSkeleton count={4} />
      <TableSkeleton columns={SUBJECT_TABLE_COLUMNS} rows={5} />
    </section>
  )
}

function HighlightCardSkeleton() {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-2 pt-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
