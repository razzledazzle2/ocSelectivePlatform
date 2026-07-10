'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { autoFillMockSectionAction, evaluateMockBlueprintAction } from '@/app/admin/mocks/actions'
import { exportMockCsvAction } from '@/app/admin/mocks/import/actions'
import { MOCK_EXPORT_MODE_LABELS, MOCK_EXPORT_MODES, type MockExportMode } from '@/lib/mock-import/schema'
import type { BlueprintEvaluation } from '@/lib/mock-blueprints/types'

interface SectionOption {
  id: string
  name: string
  hasSubject: boolean
}
interface BlueprintOption {
  id: string
  title: string
}

interface MockCsvToolsProps {
  mockTestId: string
  sections: SectionOption[]
  blueprints: BlueprintOption[]
}

export function MockCsvTools({ mockTestId, sections, blueprints }: MockCsvToolsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [exportMode, setExportMode] = useState<MockExportMode>('full')
  const fillableSections = sections.filter((section) => section.hasSubject)
  const [sectionId, setSectionId] = useState<string>(fillableSections[0]?.id ?? '')
  const [blueprintId, setBlueprintId] = useState<string>(blueprints[0]?.id ?? '')
  const [evaluation, setEvaluation] = useState<BlueprintEvaluation | null>(null)

  function runExport() {
    startTransition(async () => {
      const response = await exportMockCsvAction(mockTestId, exportMode)
      if (response.success && response.data) {
        const blob = new Blob([response.data.csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = response.data.filename
        anchor.click()
        URL.revokeObjectURL(url)
        toast.success('Mock exported.')
      } else {
        toast.error(response.message ?? 'Unable to export the mock.')
      }
    })
  }

  function runAutoFill() {
    if (!sectionId || !blueprintId) {
      toast.error('Choose a section and a blueprint.')
      return
    }
    startTransition(async () => {
      const response = await autoFillMockSectionAction({ mockTestId, sectionId, blueprintId })
      if (response.success) {
        toast.success(response.message ?? 'Section filled.')
        setEvaluation(response.data?.evaluation ?? null)
        router.refresh()
      } else {
        toast.error(response.message ?? 'Unable to auto-fill the section.')
      }
    })
  }

  function runEvaluate() {
    if (!blueprintId) {
      toast.error('Choose a blueprint.')
      return
    }
    startTransition(async () => {
      const response = await evaluateMockBlueprintAction(mockTestId, blueprintId)
      if (response.success && response.data) {
        setEvaluation(response.data)
      } else {
        toast.error(response.message ?? 'Unable to evaluate the blueprint.')
      }
    })
  }

  const exportItems = Object.fromEntries(MOCK_EXPORT_MODES.map((mode) => [mode, MOCK_EXPORT_MODE_LABELS[mode]]))
  const sectionItems = Object.fromEntries(fillableSections.map((section) => [section.id, section.name]))
  const blueprintItems = Object.fromEntries(blueprints.map((blueprint) => [blueprint.id, blueprint.title]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV &amp; blueprint tools</CardTitle>
        <CardDescription>
          Export this mock to CSV (for external editing or version control), auto-fill a section from a blueprint, or
          check blueprint compliance. All deterministic — no AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Export mode</Label>
            <Select value={exportMode} onValueChange={(value) => setExportMode(value as MockExportMode)} items={exportItems}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(exportItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={runExport} disabled={isPending}>
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
        </div>

        {blueprints.length > 0 ? (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Blueprint</Label>
                <Select value={blueprintId} onValueChange={setBlueprintId} items={blueprintItems}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(blueprintItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {fillableSections.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Auto-fill section</Label>
                  <Select value={sectionId} onValueChange={setSectionId} items={sectionItems}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(sectionItems).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {fillableSections.length > 0 ? (
                <Button type="button" onClick={runAutoFill} disabled={isPending}>
                  <SparklesIcon className="size-4" />
                  Auto-fill from bank
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={runEvaluate} disabled={isPending}>
                Check compliance
              </Button>
            </div>

            {evaluation ? (
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {evaluation.blueprintTitle}{' '}
                  {evaluation.satisfied ? (
                    <Badge>Hard rules met</Badge>
                  ) : (
                    <Badge variant="destructive">{evaluation.hardViolations} hard violation(s)</Badge>
                  )}{' '}
                  {evaluation.softWarnings > 0 ? <Badge variant="outline">{evaluation.softWarnings} warning(s)</Badge> : null}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {evaluation.checks.map((check) => (
                    <li key={check.key}>
                      {check.satisfied ? '✓' : check.enforcement === 'hard' ? '✗' : '⚠'} {check.label}: {check.detail}
                    </li>
                  ))}
                  {evaluation.checks.length === 0 ? <li>This blueprint has no configured rules.</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
