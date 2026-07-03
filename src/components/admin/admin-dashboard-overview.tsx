import Link from 'next/link'
import {
  ActivityIcon,
  BookOpenCheckIcon,
  FolderKanbanIcon,
  UsersIcon,
} from 'lucide-react'

import { DashboardCard } from '@/components/dashboard-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminDashboardStats } from '@/lib/types'
import { formatPercent, formatShortDate } from '@/utils/format'

interface AdminDashboardOverviewProps {
  stats: AdminDashboardStats
}

export function AdminDashboardOverview({ stats }: AdminDashboardOverviewProps) {
  const cards = [
    {
      label: 'Students',
      value: String(stats.totalStudents),
      detail: `${stats.totalStaff} staff account${stats.totalStaff === 1 ? '' : 's'} currently have platform access.`,
      icon: UsersIcon,
    },
    {
      label: 'Question bank',
      value: String(stats.totalQuestions),
      detail: `${stats.publishedQuestions} published, ${stats.draftQuestions} draft, ${stats.archivedQuestions} archived.`,
      icon: FolderKanbanIcon,
    },
    {
      label: 'Attempts (7 days)',
      value: String(stats.attemptsLast7Days),
      detail: 'Recent student practice activity across the last seven days.',
      icon: ActivityIcon,
    },
    {
      label: 'Active mistakes',
      value: String(stats.activeMistakes),
      detail: 'Questions still sitting in student revision queues.',
      icon: BookOpenCheckIcon,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Operations overview</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Learning platform health</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track students, content coverage, and practice activity from one admin command surface.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/questions/new" className={cn(buttonVariants({ variant: 'default' }))}>
            Add a question
          </Link>
          <Link href="/admin/students" className={cn(buttonVariants({ variant: 'outline' }))}>
            View students
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <DashboardCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent students</CardTitle>
            <CardDescription>
              The latest student accounts and a quick read on their early progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {stats.recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No student profiles are available yet.
              </p>
            ) : (
              stats.recentStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {student.fullName || student.email || 'Student account'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student.email || 'No email saved'} • Joined {formatShortDate(student.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{student.role}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-700">
                    <p>{student.questionsCompleted} attempts</p>
                    <p>{formatPercent(student.accuracy)} accuracy</p>
                    <p>{student.activeMistakes} active mistakes</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Publishing snapshot</CardTitle>
            <CardDescription>
              A fast check of where the question bank sits today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="font-medium text-slate-950">Published questions</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{stats.publishedQuestions}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                These are currently eligible for student practice.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="font-medium text-slate-950">Draft backlog</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{stats.draftQuestions}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Questions waiting for review or publication.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="font-medium text-slate-950">Archived content</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{stats.archivedQuestions}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Older or retired questions kept out of student flows.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
