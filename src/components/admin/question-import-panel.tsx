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
  SettingsIcon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ImportPreviewTable } from '@/components/admin/import-preview-table'
import { ImportValidationSummary } from '@/components/admin/import-validation-summary'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { importQuestionsAction, previewImportAction } from '@/lib/import/actions'
import { buildCsvTemplate, CSV_TEMPLATE_FILENAME } from '@/lib/import/csv-template'
import {
  DEFAULT_IMPORT_SETTINGS,
  type ImportFormat,
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
                'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                isActive && 'bg-slate-950 text-white',
                isDone && 'bg-emerald-100 text-emerald-800',
                !isActive && !isDone && 'bg-slate-100 text-slate-500'
              )}
            >
              {isDone ? <CheckCircle2Icon className="size-4" /> : number}
            </span>
            <span className={cn('text-sm', isActive ? 'font-medium text-slate-950' : 'text-muted-foreground')}>
              {label}
            </span>
            {index < steps.length - 1 ? <span className="mx-1 text-slate-300">/</span> : null}
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
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/70 bg-white p-5 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50/40">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-950 text-white">
        {icon}
      </span>
      <div>
        <p className="font-medium text-slate-950">{title}</p>
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
}: {
  label: string
  value: string
  items: Record<string, string>
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
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
    <div className={cn('rounded-2xl border border-border/70 bg-slate-50/60 p-4', disabled && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <SettingsIcon className="size-4 text-slate-600" />
        <p className="text-sm font-medium text-slate-950">Import settings</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Defaults are forgiving — missing topics and question types are created automatically as drafts.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SettingSelect
          label="Import status"
          value={settings.importStatus}
          items={{ draft: 'Draft (recommended)', published: 'Published' }}
          onChange={(value) => onChange({ ...settings, importStatus: value as ImportSettings['importStatus'] })}
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
        <SettingSelect
          label="Missing short explanation"
          value={settings.requireShortExplanation ? 'require' : 'allow'}
          items={{ allow: 'Allow (derive from solution)', require: 'Require' }}
          onChange={(value) => onChange({ ...settings, requireShortExplanation: value === 'require' })}
        />
        <SettingSelect
          label="Duplicates"
          value={settings.blockDuplicates ? 'block' : 'warn'}
          items={{ warn: 'Warn but allow', block: 'Block' }}
          onChange={(value) => onChange({ ...settings, blockDuplicates: value === 'block' })}
        />
      </div>
    </div>
  )
}

export function QuestionImportPanel() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<WizardStep>(1)
  const [format, setFormat] = useState<ImportFormat>('csv')
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('')
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_IMPORT_SETTINGS)
  const [result, setResult] = useState<ImportValidationResult | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  function chooseMethod(nextFormat: ImportFormat) {
    setFormat(nextFormat)
    setSource('')
    setFileName('')
    setResult(null)
    setImportSummary(null)
    setStep(2)
  }

  function resetWizard() {
    setStep(1)
    setSource('')
    setFileName('')
    setResult(null)
    setImportSummary(null)
    setSettings(DEFAULT_IMPORT_SETTINGS)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function updateSettings(next: ImportSettings) {
    setSettings(next)
    // Settings change what counts as an error vs warning — force a re-preview.
    setResult(null)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setResult(null)
    if (!file) {
      setSource('')
      setFileName('')
      return
    }
    setFileName(file.name)
    setSource(await file.text())
  }

  function runPreview() {
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
      const response = await importQuestionsAction(source, format, settings)
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
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Add questions</CardTitle>
            <CardDescription className="mt-1">
              Enter questions manually, upload a CSV, or paste from a document. Import is fast and forgiving —
              missing topics and question types are created for you, and everything lands as draft by default.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
            <DownloadIcon className="size-3.5" />
            Download CSV template
          </Button>
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
              description="Bulk import from a spreadsheet. Supports option_a–option_e or an options_json column."
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
                  Columns: question_text, subject, topic, question_type, difficulty, exam_type, option_a–option_e
                  (option_e may be blank), correct_answer, worked_solution, short_explanation, tags, status.
                  An options_json column also works.
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
              <Button type="button" variant="outline" disabled={isPending} onClick={runPreview}>
                <UploadCloudIcon className="size-4" />
                {isPending ? 'Checking…' : 'Preview & validate'}
              </Button>
              {fileName ? <Badge variant="outline">{fileName}</Badge> : null}
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
                    <div className="flex justify-end">
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
                  {importSummary.importedCount} imported
                  {importSummary.createdTopicCount > 0 ? `, ${importSummary.createdTopicCount} new topics` : ''}
                  {importSummary.createdQuestionTypeCount > 0
                    ? `, ${importSummary.createdQuestionTypeCount} new question types`
                    : ''}
                  {importSummary.skippedDuplicateCount > 0
                    ? `, ${importSummary.skippedDuplicateCount} duplicates skipped`
                    : ''}
                  {importSummary.failedCount > 0 ? `, ${importSummary.failedCount} failed` : ''}. Imported
                  questions are in the table below.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <ImportValidationSummary result={result} />
                <p className="text-sm text-muted-foreground">
                  {result.importableCount} question{result.importableCount === 1 ? '' : 's'} will import as{' '}
                  <span className="font-medium text-slate-950">{settings.importStatus}</span>
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
                      : `Import ${result.importableCount} question${result.importableCount === 1 ? '' : 's'}`}
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
