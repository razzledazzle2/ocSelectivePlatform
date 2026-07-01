import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function StudentRevisionPage() {
  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader>
        <CardTitle>Revision</CardTitle>
        <CardDescription>Spaced repetition and review queues will layer in once attempts are stored.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Smart Revision will be added after attempt tracking is implemented.
      </CardContent>
    </Card>
  )
}
