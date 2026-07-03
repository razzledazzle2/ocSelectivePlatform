'use client'

import Link from 'next/link'
import { FilePlus2Icon } from 'lucide-react'

import { BulkPasteImportTab } from '@/components/admin/bulk-paste-import-tab'
import { CsvImportTab } from '@/components/admin/csv-import-tab'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function QuestionImportPanel() {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>Add questions</CardTitle>
        <CardDescription>
          Enter questions manually, upload a CSV, or paste from a document. Rows are validated before anything is
          saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="csv">CSV import</TabsTrigger>
            <TabsTrigger value="paste">Bulk paste</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="pt-5">
            <div className="flex flex-col gap-4 rounded-lg border border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Create a single question</p>
                <p className="text-sm text-muted-foreground">
                  Use the full editor for one-off questions. You can also duplicate or create a similar draft from
                  any row in the table below.
                </p>
              </div>
              <Link
                href="/admin/questions/new"
                className={cn(buttonVariants({ variant: 'default' }), 'shrink-0')}
              >
                <FilePlus2Icon className="size-4" />
                New question
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="pt-5">
            <CsvImportTab />
          </TabsContent>

          <TabsContent value="paste" className="pt-5">
            <BulkPasteImportTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
