'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloudIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ImportPreviewTable } from '@/components/admin/import-preview-table'
import { ImportValidationSummary } from '@/components/admin/import-validation-summary'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { importQuestionsAction, previewImportAction } from '@/lib/import/actions'
import type { ImportFormat, ImportStatusMode, ImportValidationResult } from '@/lib/import/types'

interface QuestionImportWorkbenchProps {
  format: ImportFormat
}

const STATUS_MODE_ITEMS: Record<ImportStatusMode, string> = {
  draft: 'Import everything as draft',
  source: 'Respect the status column',
}

const PASTE_PLACEHOLDER = `Q1. What is 25% of 360?
A. 60
B. 75
C. 90
D. 120
Answer: C
Solution: 25% is one quarter. One quarter of 360 is 90.
Subject: Mathematical Reasoning
Topic: Percentages
Question Type: Multi-step percentage problem
Difficulty: 2
Exam Type: Selective`

export function QuestionImportWorkbench({ format }: QuestionImportWorkbenchProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [source, setSource] = useState('')
  const [statusMode, setStatusMode] = useState<ImportStatusMode>('draft')
  const [result, setResult] = useState<ImportValidationResult | null>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setResult(null)
    if (!file) {
      setSource('')
      return
    }
    setSource(await file.text())
  }

  function runPreview() {
    if (!source.trim()) {
      toast.error(format === 'csv' ? 'Choose a CSV file first.' : 'Paste some questions first.')
      return
    }
    startTransition(async () => {
      const response = await previewImportAction(source, format, statusMode)
      if (response.success && response.data) {
        setResult(response.data)
      } else {
        setResult(null)
        toast.error(response.message ?? 'Unable to preview the import.')
      }
    })
  }

  function runImport() {
    startTransition(async () => {
      const response = await importQuestionsAction(source, format, statusMode)
      if (response.success) {
        toast.success(response.message ?? 'Import complete.')
        setResult(null)
        setSource('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        router.refresh()
      } else {
        toast.error(response.message ?? 'Unable to import questions.')
      }
    })
  }

  return (
    <div className="space-y-5">
      {format === 'csv' ? (
        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload a .csv file</Label>
          <input
            id="csv-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            Columns supported: subject, topic, question_type, difficulty, exam_type, question_text, option_a–d,
            correct_answer, solution, short_explanation, status (slug-based headers also work).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="paste-source">Paste questions</Label>
          <Textarea
            id="paste-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
              setResult(null)
            }}
            placeholder={PASTE_PLACEHOLDER}
            rows={12}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Separate each question with a blank line or a new “Q1.” marker. Include Answer, Solution, Subject,
            Topic, Difficulty and Exam Type lines.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Status handling</Label>
          <Select value={statusMode} onValueChange={(value) => setStatusMode(value as ImportStatusMode)} items={STATUS_MODE_ITEMS}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Status handling" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Import everything as draft</SelectItem>
              <SelectItem value="source">Respect the status column</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={isPending} onClick={runPreview}>
          <UploadCloudIcon className="size-4" />
          {isPending ? 'Checking...' : 'Preview'}
        </Button>
      </div>

      {result ? (
        <>
          <Separator />
          <ImportValidationSummary result={result} />
          {result.rows.length === 0 ? (
            <Alert>
              <AlertTitle>Nothing to preview</AlertTitle>
              <AlertDescription>No questions were detected. Check the format and try again.</AlertDescription>
            </Alert>
          ) : (
            <>
              <ImportPreviewTable rows={result.rows} />
              <div className="flex justify-end">
                <Button disabled={isPending || result.readyCount === 0} onClick={runImport}>
                  {isPending
                    ? 'Importing...'
                    : `Import ${result.readyCount} ready question${result.readyCount === 1 ? '' : 's'}`}
                </Button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
