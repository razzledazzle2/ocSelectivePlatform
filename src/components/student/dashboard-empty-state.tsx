import Link from 'next/link'
import { SparklesIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export function DashboardEmptyState() {
  return (
    <EmptyState
      icon={SparklesIcon}
      title="Your progress starts here"
      description="Once you complete your first practice set, this dashboard fills with your streak, accuracy, weak areas and personalised recommendations."
      action={
        <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
          Start your first practice set
        </Link>
      }
    />
  )
}
