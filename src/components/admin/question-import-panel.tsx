'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardPasteIcon,
  DownloadIcon,
  FilePlus2Icon,
  HistoryIcon,
  SettingsIcon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ImportPreviewTable } from '@/components/admin/import-preview-table'
import { ImportValidationSummary } from '@/components/admin/import-validation-summary'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { importQuestionsAction, importQuestionsZipAction, previewImportAction, previewImportZipAction } from '@/lib/import/actions'
import { buildCsvTemplate, CSV_TEMPLATE_FILENAME } from '@/lib/import/csv-template'
import {
  DEFAULT_IMPORT_SETTINGS,
  type BlankCellBehavior,
  type ImportFormat,
  type ImportMode,
  type ImportSettings,
  type ImportSummary,
  type ImportValidationResult,
} from '@/lib/import/types'
import { cn } from '@/lib/utils'

type WizardStep = 1 | 2 | 3

const PASTE_PLACEHOLDER = `Q1. What is 25% of 360?
A. 60
B. 75
C. 90
D. 120
E. 150
Answer: C
Solution: 25% is one quarter. One quarter of 360 is 90.
Subject: Mathematical Reasoning
Topic: Percentages
Question Type: Percentage of a quantity
Difficulty: 1
Exam Type: Selective
Status: draft
Tags: percentages, arithmetic`

function downloadCsvTemplate() {
  const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = CSV_TEMPLATE_FILENAME
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** True when the validated import has at least one row-level or asset-level error/warning. */
function hasReportableIssues(result: ImportValidationResult): boolean {
  return result.rows.some(
    (row) =>
      row.errors.length > 0 ||
      row.warnings.length > 0 ||
      row.assetPreviews.some((preview) => preview.state === 'missing' || preview.state === 'invalid' || preview.state === 'rejected')
  )
}

/**
 * Builds and downloads a CSV error/warning report from the preview result: one line per issue,
 * identifying the CSV row, external_id, severity, column, referenced path and explanation so an
 * author can fix the package offline without re-running the preview.
 */
function downloadErrorReport(result: ImportValidationResult) {
  const header = ['row', 'external_id', 'severity', 'field', 'referenced_path', 'message']
  const lines = [header.join(',')]

  for (const row of result.rows) {
    const externalId = row.resolved?.externalId ?? ''
    for (const issue of row.errors) {
      lines.push([String(row.rowNumber), externalId, 'error', issue.field, '', issue.message].map(csvCell).join(','))
    }
    for (const issue of row.warnings) {
      lines.push([String(row.rowNumber), externalId, 'warning', issue.field, '', issue.message].map(csvCell).join(','))
    }
    for (const preview of row.assetPreviews) {
      if (preview.state === 'missing' || preview.state === 'invalid' || preview.state === 'rejected') {
        lines.push(
          [String(row.rowNumber), externalId, preview.state, preview.field, preview.ref, preview.message ?? '']
            .map(csvCell)
            .join(',')
        )
      }
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'import-error-report.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = ['Choose method', 'Preview & validate', 'Import']

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((label, index) => {
        const number = (index + 1) as WizardStep
        const isActive = step === number
        const isDone = step > number

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset',
                isActive && 'bg-primary text-primary-foreground ring-primary',
                isDone && 'bg-success-soft text-success ring-success/30',
                !isActive && !isDone && 'bg-muted text-muted-foreground ring-border'
              )}
            >
              {isDone ? <CheckCircle2Icon className="size-4" /> : number}
            </span>
            <span className={cn('text-sm', isActive ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden className="mx-1 h-px w-8 bg-border sm:w-12" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

interface MethodCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
  href?: string
}

function MethodCard({ icon, title, description, onClick, href }: MethodCardProps) {
  const body = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/70 bg-white p-5 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft/50">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        {icon}
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className="block h-full w-full">
      {body}
    </button>
  )
}

/** A labelled Select bound to one import setting. */
function SettingSelect({
  label,
  value,
  items,
  onChange,
  disabled,
  hint,
}: {
  label: string
  value: string
  items: Record<string, string>
  onChange: (value: string) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange} items={items} disabled={disabled}>
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ImportSettingsPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: ImportSettings
  onChange: (next: ImportSettings) => void
  disabled: boolean
}) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-muted/40 p-4', disabled && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <SettingsIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Import settings</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every row needs a stable external_id — it&apos;s the key used to match updates and is
        never regenerated. Defaults are forgiving: missing topics/question types are created
        automatically, and blank cells on an update keep the existing value.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SettingSelect
          label="Import status"
          value={settings.importStatus}
          items={{ draft: 'Draft (recommended)', published: 'Published' }}
          onChange={(value) => onChange({ ...settings, importStatus: value as ImportSettings['importStatus'] })}
        />
        <SettingSelect
          label="Import mode"
          value={settings.mode}
          items={{
            create: 'Create new only',
            update: 'Update matching only',
            create_and_update: 'Create new & update matching',
          }}
          hint="Matching is by external_id. Rows absent from the file are never touched or deleted."
          onChange={(value) => onChange({ ...settings, mode: value as ImportMode })}
        />
        <SettingSelect
          label="Blank cells (on updates)"
          value={settings.blankCellBehavior}
          items={{ keep: 'Keep existing value', clear: 'Clear existing value' }}
          disabled={settings.mode === 'create'}
          hint={settings.mode === 'create' ? 'Only applies in update modes.' : 'Required fields are always kept, even when clearing.'}
          onChange={(value) => onChange({ ...settings, blankCellBehavior: value as BlankCellBehavior })}
        />
        <SettingSelect
          label="Missing topics"
          value={settings.createMissingTopics ? 'create' : 'error'}
          items={{ create: 'Create automatically', error: 'Treat as error' }}
          onChange={(value) => onChange({ ...settings, createMissingTopics: value === 'create' })}
        />
        <SettingSelect
          label="Missing question types"
          value={settings.createMissingQuestionTypes ? 'create' : 'error'}
          items={{ create: 'Create automatically', error: 'Treat as error' }}
          onChange={(value) => onChange({ ...settings, createMissingQuestionTypes: value === 'create' })}
        />
      </div>
    </div>
  )
}

export function QuestionImportPanel() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const assetsZipInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<WizardStep>(1)
  const [format, setFormat] = useState<ImportFormat>('csv')
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('')
  const [primaryFile, setPrimaryFile] = useState<File | null>(null)
  const [primaryIsZip, setPrimaryIsZip] = useState(false)
  const [assetsZipFile, setAssetsZipFile] = useState<File | null>(null)
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_IMPORT_SETTINGS)
  const [result, setResult] = useState<ImportValidationResult | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const usesPackage = format === 'csv' && (primaryIsZip || Boolean(assetsZipFile))

  function chooseMethod(nextFormat: ImportFormat) {
    setFormat(nextFormat)
    setSource('')
    setFileName('')
    setPrimaryFile(null)
    setPrimaryIsZip(false)
    setAssetsZipFile(null)
    setResult(null)
    setImportSummary(null)
    setStep(2)
  }

  function resetWizard() {
    setStep(1)
    setSource('')
    setFileName('')
    setPrimaryFile(null)
    setPrimaryIsZip(false)
    setAssetsZipFile(null)
    setResult(null)
    setImportSummary(null)
    setSettings(DEFAULT_IMPORT_SETTINGS)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (assetsZipInputRef.current) assetsZipInputRef.current.value = ''
  }

  function updateSettings(next: ImportSettings) {
    setSettings(next)
    // Settings change what counts as an error/duplicate/diff — force a re-preview.
    setResult(null)
  }

  async function applyPrimaryFile(file: File | null) {
    setResult(null)
    if (!file) {
      setSource('')
      setFileName('')
      setPrimaryFile(null)
      setPrimaryIsZip(false)
      return
    }
    setFileName(file.name)
    const isZip = file.name.toLowerCase().endsWith('.zip')
    setPrimaryIsZip(isZip)
    if (isZip) {
      setPrimaryFile(file)
      setSource('')
    } else {
      setPrimaryFile(null)
      setSource(await file.text())
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await applyPrimaryFile(event.target.files?.[0] ?? null)
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (!/\.(csv|zip)$/i.test(file.name)) {
      toast.error('Drop a .csv or .zip file.')
      return
    }
    if (fileInputRef.current) {
      // Mirror the drop into the file input so the picker and drop stay in sync.
      fileInputRef.current.files = event.dataTransfer.files
    }
    await applyPrimaryFile(file)
  }

  function buildPackageFormData(): FormData {
    const formData = new FormData()
    formData.set('settings', JSON.stringify(settings))
    if (primaryIsZip && primaryFile) {
      formData.set('package', primaryFile)
    } else {
      formData.set('csvFile', new File([source], fileName || 'upload.csv', { type: 'text/csv' }))
      if (assetsZipFile) {
        formData.set('assetsZip', assetsZipFile)
      }
    }
    return formData
  }

  function runPreview() {
    if (usesPackage) {
      if (primaryIsZip && !primaryFile) {
        toast.error('Choose a zip file first.')
        return
      }
      if (!primaryIsZip && !source.trim()) {
        toast.error('Choose a CSV file first.')
        return
      }
      startTransition(async () => {
        const response = await previewImportZipAction(buildPackageFormData())
        if (response.success && response.data) {
          setResult(response.data)
          if (response.message) toast.warning(response.message)
        } else {
          setResult(null)
          toast.error(response.message ?? 'Unable to preview the import.')
        }
      })
      return
    }

    if (!source.trim()) {
      toast.error(format === 'csv' ? 'Choose a CSV file first.' : 'Paste some questions first.')
      return
    }
    startTransition(async () => {
      const response = await previewImportAction(source, format, settings)
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
      const response = usesPackage
        ? await importQuestionsZipAction(buildPackageFormData())
        : await importQuestionsAction(source, format, settings, fileName || undefined)
      if (response.success) {
        toast.success(response.message ?? 'Import complete.')
        setImportSummary(response.data ?? null)
        router.refresh()
      } else {
        toast.error(response.message ?? 'Unable to import questions.')
      }
    })
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Add questions</CardTitle>
            <CardDescription className="mt-1">
              Enter questions manually, upload a CSV, or paste from a document. Import is fast and forgiving —
              missing topics and question types are created for you, and everything lands as draft by default.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/import/history" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              <HistoryIcon className="size-3.5" />
              Import history
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
              <DownloadIcon className="size-3.5" />
              Download CSV template
            </Button>
          </div>
        </div>
        <StepIndicator step={step} />
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {/* -- Step 1: choose method ------------------------------------- */}
        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <MethodCard
              icon={<FilePlus2Icon className="size-5" />}
              title="Manual Entry"
              description="Use the full editor for one-off questions with flexible A–E options."
              href="/admin/questions/new"
            />
            <MethodCard
              icon={<UploadCloudIcon className="size-5" />}
              title="CSV Upload"
              description="Bulk import from a spreadsheet, optionally with a zip of asset files."
              onClick={() => chooseMethod('csv')}
            />
            <MethodCard
              icon={<ClipboardPasteIcon className="size-5" />}
              title="Bulk Paste"
              description="Paste questions straight from a document using Q1./A./Answer:/Solution: lines."
              onClick={() => chooseMethod('paste')}
            />
          </div>
        ) : null}

        {/* -- Step 2: upload/paste + settings + preview ------------------ */}
        {step === 2 ? (
          <div className="space-y-5">
            {format === 'csv' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Upload a .csv or .zip file</Label>
                  <div
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    className={cn(
                      'rounded-xl border-2 border-dashed p-4 transition-colors',
                      dragActive ? 'border-brand bg-brand-soft/50' : 'border-border/70 bg-muted/30'
                    )}
                  >
                    <div className="flex flex-col items-center gap-2 py-2 text-center">
                      <UploadCloudIcon className="size-6 text-muted-foreground" />
                      <p className="text-sm text-foreground">Drag & drop a .csv or .zip package here</p>
                      <p className="text-xs text-muted-foreground">or choose a file below</p>
                    </div>
                    <input
                      id="csv-file"
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.zip,text/csv,application/zip"
                      onChange={handleFileChange}
                      className="mt-2 flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A plain .csv works alone. A .zip may contain a root questions.csv plus an
                    assets/ directory of referenced diagrams (PNG/JPG/WEBP/SVG) and an optional manifest.json.
                  </p>
                </div>
                {!primaryIsZip ? (
                  <div className="space-y-2">
                    <Label htmlFor="assets-zip">Assets ZIP (optional)</Label>
                    <input
                      id="assets-zip"
                      ref={assetsZipInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(event) => {
                        setAssetsZipFile(event.target.files?.[0] ?? null)
                        setResult(null)
                      }}
                      className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Attach a zip of asset files referenced by the CSV&apos;s asset ref columns
                      (matched by filename). Optional — the CSV can import alone.
                    </p>
                  </div>
                ) : null}
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
                  Separate each question with a blank line or a new “Q1.” marker. A–E option lines are supported;
                  option E is only expected for subjects that use five options.
                </p>
              </div>
            )}

            <ImportSettingsPanel settings={settings} onChange={updateSettings} disabled={isPending} />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" onClick={resetWizard}>
                <ArrowLeftIcon className="size-4" />
                Back
              </Button>
              <Button type="button" variant="outline" disabled={isPending} loading={isPending} onClick={runPreview}>
                {isPending ? null : <UploadCloudIcon className="size-4" />}
                {isPending ? 'Checking…' : 'Preview & validate'}
              </Button>
              {fileName ? <Badge variant="outline">{fileName}</Badge> : null}
              {assetsZipFile ? <Badge variant="outline">{assetsZipFile.name}</Badge> : null}
            </div>

            {result ? (
              <>
                <Separator />
                <ImportValidationSummary result={result} />
                {result.rows.length === 0 ? (
                  <Alert>
                    <AlertTitle>Nothing to preview</AlertTitle>
                    <AlertDescription>
                      No questions were detected. Check the format and try again.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <ImportPreviewTable rows={result.rows} />
                    <div className="flex flex-wrap justify-end gap-3">
                      {hasReportableIssues(result) ? (
                        <Button type="button" variant="outline" onClick={() => downloadErrorReport(result)}>
                          <DownloadIcon className="size-4" />
                          Download error report
                        </Button>
                      ) : null}
                      <Button type="button" disabled={result.importableCount === 0} onClick={() => setStep(3)}>
                        Continue to import
                        <ArrowRightIcon className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        ) : null}

        {/* -- Step 3: import -------------------------------------------- */}
        {step === 3 && result ? (
          <div className="space-y-5">
            {importSummary ? (
              <Alert>
                <CheckCircle2Icon />
                <AlertTitle>Import finished</AlertTitle>
                <AlertDescription>
                  {importSummary.importedCount} created
                  {importSummary.updatedCount > 0 ? `, ${importSummary.updatedCount} updated` : ''}
                  {importSummary.unchangedCount > 0 ? `, ${importSummary.unchangedCount} unchanged` : ''}
                  {importSummary.createdTopicCount > 0 ? `, ${importSummary.createdTopicCount} new topics` : ''}
                  {importSummary.createdQuestionTypeCount > 0
                    ? `, ${importSummary.createdQuestionTypeCount} new question types`
                    : ''}
                  {importSummary.uploadedAssetCount > 0 ? `, ${importSummary.uploadedAssetCount} new image files uploaded` : ''}
                  {importSummary.reusedExistingAssetCount > 0
                    ? `, ${importSummary.reusedExistingAssetCount} existing storage objects reused`
                    : ''}
                  {importSummary.duplicateChecksumCount > 0
                    ? `, ${importSummary.duplicateChecksumCount} duplicate images reused`
                    : ''}
                  {importSummary.assetLinksCreated > 0 ? `, ${importSummary.assetLinksCreated} asset links` : ''}
                  {importSummary.rejectedAssetCount > 0 ? `, ${importSummary.rejectedAssetCount} assets rejected` : ''}
                  {importSummary.skippedDuplicateCount > 0
                    ? `, ${importSummary.skippedDuplicateCount} duplicates skipped`
                    : ''}
                  {importSummary.failedCount > 0 ? `, ${importSummary.failedCount} failed` : ''}. Imported and
                  updated questions are in the table below.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <ImportValidationSummary result={result} />
                <p className="text-sm text-muted-foreground">
                  {result.createCount} question{result.createCount === 1 ? '' : 's'} will be created
                  {result.updateCount > 0 ? `, ${result.updateCount} updated` : ''}
                  {result.unchangedCount > 0 ? `, ${result.unchangedCount} left unchanged` : ''}. New questions land as{' '}
                  <span className="font-medium text-foreground">{settings.importStatus}</span>
                  {settings.createMissingTopics || settings.createMissingQuestionTypes
                    ? ', creating any missing taxonomy'
                    : ''}
                  . Rows with warnings are included; only errors are skipped.
                </p>
              </>
            )}

            <div className="flex flex-wrap gap-3">
              {importSummary ? (
                <Button type="button" onClick={resetWizard}>
                  Start another import
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                    <ArrowLeftIcon className="size-4" />
                    Back to preview
                  </Button>
                  <Button type="button" disabled={isPending || result.importableCount === 0} onClick={runImport}>
                    {isPending
                      ? 'Importing…'
                      : `Import ${result.createCount + result.updateCount} question${
                          result.createCount + result.updateCount === 1 ? '' : 's'
                        }`}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
