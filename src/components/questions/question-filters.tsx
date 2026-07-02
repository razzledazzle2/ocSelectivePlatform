import Link from 'next/link'
import { SearchIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EXAM_TYPES, QUESTION_STATUSES, type AdminQuestionFilters, type SubjectRecord, type TopicRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

interface QuestionFiltersProps {
  filters: AdminQuestionFilters
  subjects: SubjectRecord[]
  topics: TopicRecord[]
}

const selectClassName =
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function QuestionFilters({ filters, subjects, topics }: QuestionFiltersProps) {
  const filteredTopics = filters.subjectId
    ? topics.filter((topic) => topic.subject_id === filters.subjectId)
    : topics

  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="query">Search</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="query"
                name="query"
                defaultValue={filters.query ?? ''}
                placeholder="Search question text"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="examType">Exam type</Label>
            <select id="examType" name="examType" defaultValue={filters.examType ?? ''} className={selectClassName}>
              <option value="">All exam types</option>
              {EXAM_TYPES.map((examType) => (
                <option key={examType} value={examType}>
                  {examType}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subjectId">Subject</Label>
            <select id="subjectId" name="subjectId" defaultValue={filters.subjectId ?? ''} className={selectClassName}>
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topicId">Topic</Label>
            <select id="topicId" name="topicId" defaultValue={filters.topicId ?? ''} className={selectClassName}>
              <option value="">All topics</option>
              {filteredTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue={filters.difficulty ?? ''}
              className={selectClassName}
            >
              <option value="">All difficulties</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  Difficulty {value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue={filters.status ?? ''} className={selectClassName}>
              <option value="">All statuses</option>
              {QUESTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <Button type="submit">Apply filters</Button>
            <Link href="/admin/questions" className={cn(buttonVariants({ variant: 'outline' }))}>
              Reset
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
