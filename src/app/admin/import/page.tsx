import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { QuestionImportPanel } from '@/components/admin/question-import-panel'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content workflow"
        title="Import questions"
        description="Bulk-add questions from a CSV or a pasted document. Everything lands as draft by default, ready for review in the Question Bank."
        actions={
          <>
            <Link href="/admin/questions/new" className={cn(buttonVariants({ variant: 'outline' }))}>
              <PlusIcon className="size-4" />
              Add manually
            </Link>
            <Link href="/admin/questions" className={cn(buttonVariants({ variant: 'default' }))}>
              Open Question Bank
            </Link>
          </>
        }
      />

      <QuestionImportPanel />
    </div>
  )
}
