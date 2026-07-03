'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REPORT_STATUS_LABELS, REPORT_TYPE_SHORT_LABELS } from '@/lib/reports/labels'
import {
  QUESTION_STATUSES,
  REPORT_STATUSES,
  REPORT_TYPES,
  type QuestionTypeRecord,
  type ReportFilters as ReportFiltersType,
  type ReviewerOption,
  type SubjectRecord,
  type TopicRecord,
} from '@/lib/types'

interface ReportFiltersProps {
  filters: ReportFiltersType
  subjects: SubjectRecord[]
  topics: TopicRecord[]
  questionTypes: QuestionTypeRecord[]
  reviewers: ReviewerOption[]
}

const ALL = 'all'
const UNASSIGNED = 'unassigned'

export function ReportFilters({ filters, subjects, topics, questionTypes, reviewers }: ReportFiltersProps) {
  const router = useRouter()
  const [status, setStatus] = useState(filters.status ?? ALL)
  const [reportType, setReportType] = useState(filters.reportType ?? ALL)
  const [subjectId, setSubjectId] = useState(filters.subjectId ?? ALL)
  const [topicId, setTopicId] = useState(filters.topicId ?? ALL)
  const [questionTypeId, setQuestionTypeId] = useState(filters.questionTypeId ?? ALL)
  const [questionStatus, setQuestionStatus] = useState(filters.questionStatus ?? ALL)
  const [assignedTo, setAssignedTo] = useState(filters.assignedTo ?? ALL)

  const filteredTopics = useMemo(
    () => (subjectId === ALL ? topics : topics.filter((topic) => topic.subject_id === subjectId)),
    [topics, subjectId]
  )
  const filteredTypes = useMemo(
    () => (subjectId === ALL ? questionTypes : questionTypes.filter((type) => type.subject_id === subjectId)),
    [questionTypes, subjectId]
  )

  const statusItems = { [ALL]: 'All statuses', ...Object.fromEntries(REPORT_STATUSES.map((v) => [v, REPORT_STATUS_LABELS[v]])) }
  const reportTypeItems = { [ALL]: 'All types', ...Object.fromEntries(REPORT_TYPES.map((v) => [v, REPORT_TYPE_SHORT_LABELS[v]])) }
  const questionStatusItems = { [ALL]: 'All question states', ...Object.fromEntries(QUESTION_STATUSES.map((v) => [v, v])) }
  const subjectItems = useMemo(
    () => ({ [ALL]: 'All subjects', ...Object.fromEntries(subjects.map((s) => [s.id, s.name])) }),
    [subjects]
  )
  const topicItems = useMemo(
    () => ({ [ALL]: 'All topics', ...Object.fromEntries(filteredTopics.map((t) => [t.id, t.name])) }),
    [filteredTopics]
  )
  const typeItems = useMemo(
    () => ({ [ALL]: 'All question types', ...Object.fromEntries(filteredTypes.map((t) => [t.id, t.name])) }),
    [filteredTypes]
  )
  const reviewerItems = useMemo(
    () => ({
      [ALL]: 'Anyone',
      [UNASSIGNED]: 'Unassigned',
      ...Object.fromEntries(reviewers.map((r) => [r.id, r.name])),
    }),
    [reviewers]
  )

  function handleSubjectChange(next: string) {
    setSubjectId(next)
    setTopicId(ALL)
    setQuestionTypeId(ALL)
  }

  function applyFilters() {
    const params = new URLSearchParams()
    if (status !== ALL) params.set('status', status)
    if (reportType !== ALL) params.set('reportType', reportType)
    if (subjectId !== ALL) params.set('subjectId', subjectId)
    if (topicId !== ALL) params.set('topicId', topicId)
    if (questionTypeId !== ALL) params.set('questionTypeId', questionTypeId)
    if (questionStatus !== ALL) params.set('questionStatus', questionStatus)
    if (assignedTo !== ALL) params.set('assignedTo', assignedTo)

    const queryString = params.toString()
    router.push(queryString ? `/admin/reports?${queryString}` : '/admin/reports')
  }

  function resetFilters() {
    setStatus(ALL)
    setReportType(ALL)
    setSubjectId(ALL)
    setTopicId(ALL)
    setQuestionTypeId(ALL)
    setQuestionStatus(ALL)
    setAssignedTo(ALL)
    router.push('/admin/reports')
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <div className="space-y-2">
            <Label>Report status</Label>
            <Select value={status} onValueChange={setStatus} items={statusItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {REPORT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REPORT_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Report type</Label>
            <Select value={reportType} onValueChange={setReportType} items={reportTypeItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {REPORT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REPORT_TYPE_SHORT_LABELS[value]}
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
            <Label>Question type</Label>
            <Select value={questionTypeId} onValueChange={setQuestionTypeId} items={typeItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All question types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All question types</SelectItem>
                {filteredTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Question state</Label>
            <Select value={questionStatus} onValueChange={setQuestionStatus} items={questionStatusItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All question states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All question states</SelectItem>
                {QUESTION_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assigned reviewer</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} items={reviewerItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {reviewers.map((reviewer) => (
                  <SelectItem key={reviewer.id} value={reviewer.id}>
                    {reviewer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
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
