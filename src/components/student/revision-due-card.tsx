import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RevisionDueSummary } from '@/lib/types'

interface RevisionDueCardProps {
  revisionDue: RevisionDueSummary
}

export function RevisionDueCard({ revisionDue }: RevisionDueCardProps) {
  const hasDue = revisionDue.dueCount > 0

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>Revision due today</CardTitle>
        <CardDescription>
          {hasDue
            ? `${revisionDue.dueCount} question${revisionDue.dueCount === 1 ? '' : 's'} ready to review.`
            : 'Nothing is due right now — you are all caught up.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDue ? (
          <>
            <p className="text-4xl font-semibold tracking-tight text-foreground">{revisionDue.dueCount}</p>
            {revisionDue.topAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {revisionDue.topAreas.map((area) => (
                  <Badge key={area.name} variant="secondary">
                    {area.name} · {area.count}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Link href="/student/revision" className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
              Start revision
            </Link>
          </>
        ) : (
          <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Open revision queue
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
