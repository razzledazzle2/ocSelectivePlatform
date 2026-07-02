'use client'

import { useRef, useState, useTransition } from 'react'
import { FileSpreadsheetIcon, UploadCloudIcon } from 'lucide-react'

import {
  importQuestionCsvRowsAction,
  previewQuestionCsvImportAction,
} from '@/app/admin/questions/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  ActionResult,
  CsvImportableQuestion,
  QuestionCsvImportSummary,
  QuestionCsvPreviewResult,
} from '@/lib/types'

interface QuestionImportPanelProps {
  className?: string
}

const emptyImportResult: ActionResult<QuestionCsvImportSummary> = {
  success: false,
}

export function QuestionImportPanel({ className }: QuestionImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<QuestionCsvPreviewResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ActionResult<QuestionCsvImportSummary>>(emptyImportResult)

  async function handlePreview() {
    const file = fileInputRef.current?.files?.[0]

    if (!file) {
      setMessage('Choose a CSV file before previewing the import.')
      return
    }

    const formData = new FormData()
    formData.set('file', file)

    startTransition(async () => {
      const result = await previewQuestionCsvImportAction(formData)
      setMessage(result.message ?? null)
      setImportResult(emptyImportResult)

      if (result.success && result.data) {
        setPreview(result.data)
        return
      }

      setPreview(null)
    })
  }

  async function handleImport(rows: CsvImportableQuestion[]) {
    startTransition(async () => {
      const result = await importQuestionCsvRowsAction(rows)
      setImportResult(result)
      setMessage(result.message ?? null)

      if (result.success) {
        setPreview(null)

        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    })
  }

  return (
    <Card className={className ?? 'border-white/70 bg-white/94 shadow-lg shadow-slate-200/50'}>
      <CardHeader className="border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FileSpreadsheetIcon className="size-5" />
          </div>
          <div>
            <CardTitle>Bulk CSV import</CardTitle>
            <CardDescription>
              Validate rows before import, preview issues clearly, then insert only the valid questions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <label htmlFor="question-csv-file" className="text-sm font-medium text-slate-950">
              Upload `.csv`
            </label>
            <input
              id="question-csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button disabled={isPending} onClick={() => void handlePreview()}>
            <UploadCloudIcon className="size-4" />
            {isPending ? 'Checking...' : 'Preview CSV'}
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          Expected columns: `exam_type`, `year_level`, `subject_slug`, `topic_slug`,
          `question_type_slug`, `difficulty`, `question_text`, `passage_text`, `option_a`,
          `option_b`, `option_c`, `option_d`, `correct_option_label`, `short_explanation`,
          `worked_solution`, `status`.
        </div>

        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        {importResult.success && importResult.data ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            <p>
              Imported {importResult.data.importedCount} row
              {importResult.data.importedCount === 1 ? '' : 's'}.
            </p>
            {importResult.data.skippedDuplicateCount ? (
              <p className="mt-1">
                Skipped {importResult.data.skippedDuplicateCount} duplicate row
                {importResult.data.skippedDuplicateCount === 1 ? '' : 's'}.
              </p>
            ) : null}
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{preview.fileName}</Badge>
                <Badge variant="outline">{preview.totalRows} total rows</Badge>
                <Badge>{preview.validRows.length} valid rows</Badge>
                <Badge variant="outline">
                  {preview.previewRows.filter((row) => row.errors.length > 0).length} rows with issues
                </Badge>
              </div>
              <Button
                disabled={isPending || preview.validRows.length === 0}
                onClick={() => void handleImport(preview.validRows)}
              >
                {isPending ? 'Importing...' : `Import ${preview.validRows.length} valid row${preview.validRows.length === 1 ? '' : 's'}`}
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="max-h-[28rem] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Row</th>
                      <th className="px-4 py-3 font-medium">Question</th>
                      <th className="px-4 py-3 font-medium">Taxonomy</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white align-top">
                    {preview.previewRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-4 py-4 font-medium text-slate-950">{row.rowNumber}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-950">{row.questionText || 'Missing question text'}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {row.examType || 'No exam type'} • Difficulty {row.difficulty || 'n/a'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <p>{row.subjectSlug || 'No subject slug'}</p>
                          <p className="text-muted-foreground">{row.topicSlug || 'No topic slug'}</p>
                          <p className="text-muted-foreground">
                            {row.questionTypeSlug || 'No question type slug'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={row.errors.length === 0 ? 'default' : 'outline'}>
                            {row.status || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {row.errors.length === 0 ? (
                            <p className="font-medium text-emerald-700">Ready to import</p>
                          ) : (
                            <div className="space-y-2">
                              {row.errors.map((error) => (
                                <p key={`${row.rowNumber}-${error.field}`} className="text-xs leading-5 text-amber-900">
                                  {error.field}: {error.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
