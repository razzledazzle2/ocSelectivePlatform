'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EXAM_TYPES,
  QUESTION_STATUSES,
  type AdminQuestionFilters,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface QuestionFiltersProps {
  filters: AdminQuestionFilters
  subjects: SubjectRecord[]
  topics: TopicRecord[]
}

const ALL = 'all'
const difficultyValues = ['1', '2', '3', '4', '5'] as const

export function QuestionFilters({ filters, subjects, topics }: QuestionFiltersProps) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.query ?? '')
  const [examType, setExamType] = useState(filters.examType ?? ALL)
  const [subjectId, setSubjectId] = useState(filters.subjectId ?? ALL)
  const [topicId, setTopicId] = useState(filters.topicId ?? ALL)
  const [difficulty, setDifficulty] = useState(filters.difficulty ?? ALL)
  const [status, setStatus] = useState(filters.status ?? ALL)

  const filteredTopics = useMemo(
    () => (subjectId === ALL ? topics : topics.filter((topic) => topic.subject_id === subjectId)),
    [topics, subjectId]
  )

  // base-ui Select needs value->label maps so triggers show names, not raw ids/values.
  const examItems = { [ALL]: 'All exam types', ...Object.fromEntries(EXAM_TYPES.map((v) => [v, v])) }
  const statusItems = { [ALL]: 'All statuses', ...Object.fromEntries(QUESTION_STATUSES.map((v) => [v, v])) }
  const difficultyItems = {
    [ALL]: 'All difficulties',
    ...Object.fromEntries(difficultyValues.map((v) => [v, `Difficulty ${v}`])),
  }
  const subjectItems = useMemo(
    () => ({ [ALL]: 'All subjects', ...Object.fromEntries(subjects.map((s) => [s.id, s.name])) }),
    [subjects]
  )
  const topicItems = useMemo(
    () => ({ [ALL]: 'All topics', ...Object.fromEntries(filteredTopics.map((t) => [t.id, t.name])) }),
    [filteredTopics]
  )

  function handleSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    setTopicId(ALL)
  }

  function applyFilters() {
    const params = new URLSearchParams()
    const trimmedQuery = query.trim()

    if (trimmedQuery) params.set('query', trimmedQuery)
    if (examType !== ALL) params.set('examType', examType)
    if (subjectId !== ALL) params.set('subjectId', subjectId)
    if (topicId !== ALL) params.set('topicId', topicId)
    if (difficulty !== ALL) params.set('difficulty', difficulty)
    if (status !== ALL) params.set('status', status)

    const queryString = params.toString()
    router.push(queryString ? `/admin/questions?${queryString}` : '/admin/questions')
  }

  function resetFilters() {
    setQuery('')
    setExamType(ALL)
    setSubjectId(ALL)
    setTopicId(ALL)
    setDifficulty(ALL)
    setStatus(ALL)
    router.push('/admin/questions')
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="query">Search</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search question text"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Exam type</Label>
            <Select value={examType} onValueChange={setExamType} items={examItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All exam types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All exam types</SelectItem>
                {EXAM_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={handleSubjectChange} items={subjectItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Topic</Label>
            <Select value={topicId} onValueChange={setTopicId} items={topicItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All topics</SelectItem>
                {filteredTopics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty} items={difficultyItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All difficulties</SelectItem>
                {difficultyValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    Difficulty {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} items={statusItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {QUESTION_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
