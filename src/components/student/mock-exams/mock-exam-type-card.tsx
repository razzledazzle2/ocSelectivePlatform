'use client'

import { ClockIcon, ListChecksIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { MockExamTypeConfig } from '@/lib/mock-exams/config'
import { formatTimeLimit } from '@/components/student/mock-exams/utils'
import type { ExamType, SubjectRecord } from '@/lib/types'

interface MockExamTypeCardProps {
  config: MockExamTypeConfig
  examType: ExamType
  subjects: SubjectRecord[]
  subjectId: string
  onSubjectChange: (subjectId: string) => void
  onStart: () => void
  isPending: boolean
}

export function MockExamTypeCard({
  config,
  examType,
  subjects,
  subjectId,
  onSubjectChange,
  onStart,
  isPending,
}: MockExamTypeCardProps) {
  const effectiveExamType = config.fixedExamType ?? examType
  const subjectItems = Object.fromEntries(subjects.map((subject) => [subject.id, subject.name]))
  const canStart = config.requiresSubject ? Boolean(subjectId) : true

  return (
    <Card
      className={cn(
        'flex h-full flex-col border-white/70 bg-white/94 shadow-lg shadow-slate-200/50 transition-shadow hover:shadow-xl'
      )}
    >
      <CardHeader className="space-y-3 border-b border-border/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
            {config.tagline}
          </p>
          <Badge variant="outline">{effectiveExamType}</Badge>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{config.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{config.description}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <ListChecksIcon className="size-4 text-slate-500" />
            {config.questionCount} questions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-4 text-slate-500" />
            {formatTimeLimit(config.timeLimitSeconds)}
          </span>
        </div>

        {config.requiresSubject ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </label>
            <Select value={subjectId} onValueChange={onSubjectChange} items={subjectItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="mt-auto pt-2">
          <Button className="w-full" onClick={onStart} disabled={!canStart || isPending}>
            {isPending ? 'Preparing…' : 'Start exam'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
