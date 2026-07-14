'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2Icon, DownloadIcon, UploadCloudIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { importMockAction, previewMockImportAction } from '@/app/admin/mocks/import/actions'
import { buildMockTemplateCsv, MOCK_CSV_TEMPLATE_FILENAME } from '@/lib/mock-import/schema'
import type { MockImportSummary, MockImportValidationResult } from '@/lib/mock-import/types'
import { EXAM_TYPES, type ExamType } from '@/lib/types'

interface BlueprintOption {
  id: string
  title: string
}

interface MockImportPanelProps {
  blueprints: BlueprintOption[]
}

function downloadTemplate() {
  const blob = new Blob([buildMockTemplateCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = MOCK_CSV_TEMPLATE_FILENAME
  anchor.click()
  URL.revokeObjectURL(url)
}

const MODE_ITEMS: Record<string, string> = { create: 'Create new mock', update: 'Update existing mock' }
const BANK_ITEMS: Record<string, string> = { false: 'Mock-only (keep out of the bank)', true: 'Also add to question bank' }

export function MockImportPanel({ blueprints }: MockImportPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'create' | 'update'>('create')
  const [examType, setExamType] = useState<ExamType>('Selective')
  const [alsoAddToBank, setAlsoAddToBank] = useState(false)
  const [blueprintId, setBlueprintId] = useState<string>('')
  const [csvName, setCsvName] = useState<string>('')
  const [zipName, setZipName] = useState<string>('')

  const [result, setResult] = useState<MockImportValidationResult | null>(null)
  const [summary, setSummary] = useState<MockImportSummary | null>(null)

  function buildFormData(): FormData | null {
    const csvFile = fileRef.current?.files?.[0]
    if (!csvFile) {
      toast.error('Choose a mock CSV or ZIP first.')
      return null
    }
    const form = new FormData()
    // A .zip file goes in as the single package; a .csv goes in as csvFile (+ optional assets zip).
    if (csvFile.name.toLowerCase().endsWith('.zip')) {
      form.set('package', csvFile)
    } else {
      form.set('csvFile', csvFile)
      const zip = zipRef.current?.files?.[0]
      if (zip) form.set('assetsZip', zip)
    }
    form.set('mode', mode)
    form.set('examType', examType)
    form.set('alsoAddToBank', String(alsoAddToBank))
    if (blueprintId) form.set('blueprintId', blueprintId)
    return form
  }

  function runPreview() {
    const form = buildFormData()
    if (!form) return
    startTransition(async () => {
      const response = await previewMockImportAction(form)
      setSummary(null)
      if (response.data) {
        setResult(response.data)
      }
      if (!response.success) {
        toast.error(response.message ?? 'Unable to validate the mock CSV.')
      } else if (response.message) {
        toast.warning(response.message)
      } else {
        toast.success('Validation complete.')
      }
    })
  }

  function runImport() {
    const form = buildFormData()
    if (!form) return
    startTransition(async () => {
      const response = await importMockAction(form)
      if (response.success && response.data) {
        toast.success(response.message ?? 'Mock imported.')
        setSummary(response.data)
        router.refresh()
      } else {
        toast.error(response.message ?? 'Unable to import the mock.')
      }
    })
  }

  const canImport = result != null && !result.parseError && result.importableCount > 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Upload a mock CSV</CardTitle>
              <CardDescription>
                A dedicated mock schema, one row per question. Rows may define new questions or reference existing bank
                questions by external id. Attach an assets ZIP for any diagrams.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <DownloadIcon className="size-4" />
              Download template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mock-csv">Mock CSV or ZIP</Label>
              <input
                id="mock-csv"
                ref={fileRef}
                type="file"
                accept=".csv,.zip"
                onChange={(event) => {
                  setCsvName(event.target.files?.[0]?.name ?? '')
                  setResult(null)
                  setSummary(null)
                }}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
              />
              {csvName ? <p className="text-xs text-muted-foreground">{csvName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-assets">Assets ZIP (optional)</Label>
              <input
                id="mock-assets"
                ref={zipRef}
                type="file"
                accept=".zip"
                onChange={(event) => setZipName(event.target.files?.[0]?.name ?? '')}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {zipName ? <p className="text-xs text-muted-foreground">{zipName}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SettingSelect label="Mode" value={mode} items={MODE_ITEMS} onChange={(value) => setMode(value as 'create' | 'update')} />
            <SettingSelect
              label="Exam type"
              value={examType}
              items={Object.fromEntries(EXAM_TYPES.map((type) => [type, type]))}
              onChange={(value) => setExamType(value as ExamType)}
            />
            <SettingSelect
              label="New questions"
              value={String(alsoAddToBank)}
              items={BANK_ITEMS}
              onChange={(value) => setAlsoAddToBank(value === 'true')}
            />
            <SettingSelect
              label="Blueprint (optional)"
              value={blueprintId || 'none'}
              items={{ none: 'No blueprint', ...Object.fromEntries(blueprints.map((bp) => [bp.id, bp.title])) }}
              onChange={(value) => setBlueprintId(value === 'none' ? '' : value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={runPreview} disabled={isPending}>
              Validate &amp; preview
            </Button>
            <Button type="button" onClick={runImport} disabled={isPending || !canImport}>
              <UploadCloudIcon className="size-4" />
              Import as draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? <MockPreview result={result} /> : null}
      {summary ? <MockImportSummaryCard summary={summary} /> : null}
    </div>
  )
}

function SettingSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: Record<string, string>
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} items={items}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([itemValue, itemLabel]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MockPreview({ result }: { result: MockImportValidationResult }) {
  if (result.parseError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not read the mock CSV</AlertTitle>
        <AlertDescription>{result.parseError}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {result.mockName ?? result.mockExternalId ?? 'Mock preview'}
          {result.matchesExistingMock ? <Badge variant="outline">Matches existing mock</Badge> : <Badge>New mock</Badge>}
        </CardTitle>
        <CardDescription>
          {result.totalRows} row{result.totalRows === 1 ? '' : 's'} · {result.newQuestionCount} new ·{' '}
          {result.referencedQuestionCount} referenced · {result.errorCount} with errors · {result.warningCount} with
          warnings · {result.missingAssetCount} missing/pending asset{result.missingAssetCount === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.duplicateOrderIndexes.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Duplicate order_index</AlertTitle>
            <AlertDescription>Values reused: {result.duplicateOrderIndexes.join(', ')}.</AlertDescription>
          </Alert>
        ) : null}

        {result.blueprint ? (
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">
              Blueprint: {result.blueprint.blueprintTitle}{' '}
              {result.blueprint.satisfied ? (
                <Badge>Hard rules met</Badge>
              ) : (
                <Badge variant="destructive">{result.blueprint.hardViolations} hard violation(s)</Badge>
              )}{' '}
              {result.blueprint.softWarnings > 0 ? <Badge variant="outline">{result.blueprint.softWarnings} warning(s)</Badge> : null}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {result.blueprint.checks.map((check) => (
                <li key={check.key}>
                  {check.satisfied ? '✓' : check.enforcement === 'hard' ? '✗' : '⚠'} {check.label}: {check.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Issues</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.rowNumber} className="border-t border-border align-top">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.rowStatus === 'error' ? 'destructive' : row.rowStatus === 'warning' ? 'outline' : 'default'}>
                      {row.rowStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.kind === 'new_question' ? 'New' : 'Reference'}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">{row.summary}</td>
                  <td className="px-3 py-2 text-xs">
                    {[...row.errors, ...row.warnings].length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.errors.map((issue, index) => (
                          <li key={`e${index}`} className="text-destructive">
                            <strong>{issue.field}</strong>: {issue.message}
                            {issue.expected ? <span className="text-muted-foreground"> (expected: {issue.expected})</span> : null}
                          </li>
                        ))}
                        {row.warnings.map((issue, index) => (
                          <li key={`w${index}`} className="text-amber-600 dark:text-amber-500">
                            <strong>{issue.field}</strong>: {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.unusedAssetFiles.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Unused files in the ZIP: {result.unusedAssetFiles.join(', ')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MockImportSummaryCard({ summary }: { summary: MockImportSummary }) {
  return (
    <Alert>
      <CheckCircle2Icon className="size-4" />
      <AlertTitle>{summary.created ? 'Mock created' : 'Mock updated'} — imported as draft</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {summary.questionsCreated} new question{summary.questionsCreated === 1 ? '' : 's'}, {summary.questionsUpdated}{' '}
          updated, {summary.questionsReferenced} referenced · {summary.assetsUploaded} asset
          {summary.assetsUploaded === 1 ? '' : 's'} uploaded · {summary.assetsPending} pending · {summary.addedToBank}{' '}
          added to bank.
        </p>
        {summary.warnings.length > 0 ? (
          <ul className="list-disc pl-4 text-xs text-muted-foreground">
            {summary.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/admin/mocks/${summary.mockTestId}`}
          className="inline-flex text-sm font-medium text-brand hover:underline"
        >
          Open the mock to review and publish →
        </Link>
      </AlertDescription>
    </Alert>
  )
}
