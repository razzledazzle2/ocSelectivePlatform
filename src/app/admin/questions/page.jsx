import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminQuestionsPage() {
  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader>
        <CardTitle>Question management</CardTitle>
        <CardDescription>
          This area will evolve into the editorial workflow for exam questions and tagging.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Question management will be added in Phase 1.
      </CardContent>
    </Card>
  )
}
