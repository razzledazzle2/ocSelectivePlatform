import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function StudentPracticePage() {
  return (
    <Card className="border-white/70 bg-white/92 shadow-lg shadow-slate-200/50">
      <CardHeader>
        <CardTitle>Practice</CardTitle>
        <CardDescription>Phase 1 will connect this route to the actual question experience.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Practice mode will be added in Phase 1.
      </CardContent>
    </Card>
  )
}
