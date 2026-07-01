import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminStudentsPage() {
  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader>
        <CardTitle>Student management</CardTitle>
        <CardDescription>
          Role-aware profile infrastructure is now in place, ready for richer admin tooling later.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Student management will be expanded in a later phase.
      </CardContent>
    </Card>
  )
}
