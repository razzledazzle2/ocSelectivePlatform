'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createBlueprintAction,
  deleteBlueprintAction,
  setBlueprintStatusAction,
  updateBlueprintAction,
} from '@/app/admin/mocks/blueprints/actions'
import type { MockBlueprint, MockBlueprintSpec } from '@/lib/mock-blueprints/types'
import { EXAM_TYPES } from '@/lib/types'

const SUBJECT_ITEMS: Record<string, string> = {
  '': 'Any subject',
  mathematical_reasoning: 'Mathematical Reasoning',
  thinking_skills: 'Thinking Skills',
  reading: 'Reading',
  writing: 'Writing',
}

const STATUS_ITEMS: Record<string, string> = { draft: 'Draft', active: 'Active', archived: 'Archived' }

const EXAM_ITEMS: Record<string, string> = { '': 'Any', ...Object.fromEntries(EXAM_TYPES.map((type) => [type, type])) }

const EXAMPLE_SPEC: MockBlueprintSpec = {
  totalQuestions: { min: 20, max: 25 },
  domainTargets: [
    { domainCode: 'number_algebra', min: 6 },
    { domainCode: 'measurement_financial', min: 4 },
  ],
  difficultyTargets: [
    { difficulty: 2, min: 4 },
    { difficulty: 4, min: 4 },
  ],
  requiredSubtopics: [{ subtopicCode: 'fractions', min: 1 }],
  minDistinctPatternKeys: 12,
  maxAnswerShare: 0.35,
  hardRules: ['total', 'required_subtopics'],
}

interface BlueprintEditorProps {
  blueprint: MockBlueprint | null
}

export function BlueprintEditor({ blueprint }: BlueprintEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(blueprint?.title ?? '')
  const [description, setDescription] = useState(blueprint?.description ?? '')
  const [examType, setExamType] = useState(blueprint?.examType ?? '')
  const [subjectCode, setSubjectCode] = useState(blueprint?.subjectCode ?? '')
  const [status, setStatus] = useState(blueprint?.status ?? 'draft')
  const [specText, setSpecText] = useState(
    JSON.stringify(blueprint?.spec && Object.keys(blueprint.spec).length > 0 ? blueprint.spec : EXAMPLE_SPEC, null, 2)
  )

  function buildFormData(): FormData {
    const form = new FormData()
    form.set('title', title)
    form.set('description', description)
    form.set('examType', examType)
    form.set('subjectCode', subjectCode)
    form.set('status', status)
    form.set('spec', specText)
    return form
  }

  function save() {
    // Validate JSON client-side for a fast error.
    try {
      JSON.parse(specText)
    } catch {
      toast.error('The blueprint rules are not valid JSON.')
      return
    }
    startTransition(async () => {
      const form = buildFormData()
      const response = blueprint
        ? await updateBlueprintAction(blueprint.id, form)
        : await createBlueprintAction(form)
      if (response.success) {
        toast.success(response.message ?? 'Saved.')
        const redirectTo = (response.data as { redirectTo?: string } | undefined)?.redirectTo
        if (redirectTo) {
          router.push(redirectTo)
        } else {
          router.refresh()
        }
      } else {
        toast.error(response.message ?? 'Unable to save the blueprint.')
      }
    })
  }

  function changeStatus(next: 'draft' | 'active' | 'archived') {
    if (!blueprint) return
    startTransition(async () => {
      const response = await setBlueprintStatusAction(blueprint.id, next)
      if (response.success) {
        setStatus(next)
        toast.success(response.message ?? 'Status updated.')
        router.refresh()
      } else {
        toast.error(response.message ?? 'Unable to change the status.')
      }
    })
  }

  function remove() {
    if (!blueprint) return
    if (!window.confirm('Delete this blueprint? Mocks that used it keep their questions.')) return
    startTransition(async () => {
      const response = await deleteBlueprintAction(blueprint.id)
      if (response.success) {
        toast.success(response.message ?? 'Deleted.')
        router.push('/admin/mocks/blueprints')
      } else {
        toast.error(response.message ?? 'Unable to delete the blueprint.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blueprint details</CardTitle>
          <CardDescription>Deterministic, rule-based targets — no AI. Used by the automatic builder and to validate imported mocks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bp-title">Title</Label>
              <Input id="bp-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Maths Reasoning — Selective standard" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bp-description">Description</Label>
              <Textarea id="bp-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
            </div>
            <Field label="Subject">
              <Select value={subjectCode} onValueChange={setSubjectCode} items={SUBJECT_ITEMS}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SUBJECT_ITEMS).map(([value, label]) => (
                    <SelectItem key={value || 'any'} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Exam type">
              <Select value={examType} onValueChange={setExamType} items={EXAM_ITEMS}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXAM_ITEMS).map(([value, label]) => (
                    <SelectItem key={value || 'any'} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Rules (spec)</CardTitle>
              <CardDescription>
                JSON: totalQuestions, domainTargets, difficultyTargets, requiredSubtopics, minDistinctPatternKeys,
                maxAnswerShare, hardRules. Anything in hardRules blocks; the rest warn.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSpecText(JSON.stringify(EXAMPLE_SPEC, null, 2))}>
              Insert example
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={specText}
            onChange={(event) => setSpecText(event.target.value)}
            rows={16}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={isPending}>
          {blueprint ? 'Save blueprint' : 'Create blueprint'}
        </Button>
        {blueprint ? (
          <>
            <Select value={status} onValueChange={(value) => changeStatus(value as 'draft' | 'active' | 'archived')} items={STATUS_ITEMS}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="destructive" onClick={remove} disabled={isPending}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
