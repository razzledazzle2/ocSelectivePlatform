import { Badge } from '@/components/ui/badge'
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { cn } from '@/lib/utils'
import type { StimulusType, StudentStimulus } from '@/lib/types'

const STIMULUS_TYPE_LABELS: Record<StimulusType, string> = {
  passage: 'Passage',
  paired_extract: 'Paired extract',
  poem: 'Poem',
  information_text: 'Information text',
  cloze_passage: 'Cloze passage',
  table: 'Table',
  chart: 'Chart',
  logic_grid: 'Logic grid',
  rule_box: 'Rule box',
  writing_context: 'Writing context',
  image_set: 'Image set',
}

interface StimulusPanelProps {
  stimulus: StudentStimulus
  className?: string
}

/**
 * Shared stimulus (passage/poem/table/chart/...) panel. Matches the legacy
 * passage box styling used across the practice/mock/revision runners.
 */
export function StimulusPanel({ stimulus, className }: StimulusPanelProps) {
  const typeLabel = STIMULUS_TYPE_LABELS[stimulus.stimulusType] ?? 'Stimulus'

  return (
    <div className={cn('space-y-3 rounded-2xl border border-border bg-muted/50 px-4 py-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{typeLabel}</Badge>
        {stimulus.title ? (
          <p className="text-sm font-semibold text-foreground">{stimulus.title}</p>
        ) : null}
      </div>
      <QuestionMarkdown
        text={stimulus.bodyMarkdown}
        className="text-sm leading-7 text-foreground/80"
      />
      {stimulus.assets.length ? (
        <div className="space-y-3">
          {stimulus.assets.map((asset) => (
            <QuestionAsset key={asset.id} asset={asset} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
