import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ProgressAreaPerformance } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LayersIcon } from 'lucide-react'

interface AreaPerformanceTableProps {
  areas: ProgressAreaPerformance[]
}

function accuracyTone(accuracy: number): 'default' | 'secondary' | 'destructive' {
  if (accuracy >= 75) return 'default'
  if (accuracy >= 50) return 'secondary'
  return 'destructive'
}

export function AreaPerformanceTable({ areas }: AreaPerformanceTableProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader>
        <CardTitle>Subject & topic performance</CardTitle>
        <CardDescription>Lifetime accuracy by area — mastery reflects skill, not just this period.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {areas.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={LayersIcon}
              title="No area data yet"
              description="Practise across a few topics and a per-area breakdown will appear here."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Attempted</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Practise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={`${area.subjectName}-${area.topicName ?? ''}`}>
                  <TableCell>
                    <span className="text-sm font-medium text-foreground">{area.subjectName}</span>
                    {area.topicName ? (
                      <span className="ml-2 text-xs text-muted-foreground">{area.topicName}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{area.attempts}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={accuracyTone(area.accuracy)}>{area.accuracy}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href="/student/practice"
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      Practise
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
