import Link from 'next/link'
import { SparklesIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function DashboardEmptyState() {
  return (
    <Card className="border-dashed border-border bg-card">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SparklesIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Your progress starts here</h3>
          <p className="text-sm text-muted-foreground">
            Once you complete your first practice set, this dashboard fills with your streak, accuracy, weak areas
            and personalised recommendations.
          </p>
        </div>
        <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
          Start your first practice set
        </Link>
      </CardContent>
    </Card>
  )
}
