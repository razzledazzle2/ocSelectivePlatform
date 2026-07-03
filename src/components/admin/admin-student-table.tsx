import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminStudentRow } from '@/lib/types'
import { formatPercent, formatShortDate } from '@/utils/format'

interface AdminStudentTableProps {
  students: AdminStudentRow[]
}

export function AdminStudentTable({ students }: AdminStudentTableProps) {
  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Student progress overview</CardTitle>
        <CardDescription>
          A lightweight operations table for enrolment, activity, and mistake tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {students.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            No student profiles are available yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Mistakes</TableHead>
                <TableHead>Last attempt</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {student.fullName || student.email || 'Student account'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {student.email || 'No email saved'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{student.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-foreground/80">
                      <p>{student.questionsCompleted} total</p>
                      <p className="text-muted-foreground">
                        {student.correctAnswers} correct / {student.incorrectAnswers} incorrect
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatPercent(student.accuracy)}</TableCell>
                  <TableCell>{student.activeMistakes}</TableCell>
                  <TableCell>{formatShortDate(student.latestAttemptAt)}</TableCell>
                  <TableCell>{formatShortDate(student.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
