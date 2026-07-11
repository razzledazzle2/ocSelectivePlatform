import { Badge } from '@/components/ui/badge'
import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import {
  isInlineSupportingBody,
  resolveStimulusVariant,
  shouldShowStimulusTitle,
  type StimulusVariant,
} from '@/lib/content/stimulus-presentation'
import { cn } from '@/lib/utils'
import type { StimulusType, StudentStimulus } from '@/lib/types'

/**
 * Human labels for the internal stimulus_type. ADMIN-ONLY — never shown to
 * students (see the guard in the component). Kept here so the admin surfaces can
 * still see the classification.
 */
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
  /**
   * Presentation variant. When omitted it is inferred from `subjectName`
   * (Reading → passage treatment, everything else → compact supporting).
   */
  variant?: StimulusVariant
  subjectName?: string | null
  /**
   * Admin-only: expose the internal stimulus-type badge. Students never see it.
   */
  showTypeLabel?: boolean
  className?: string
}

function StimulusAssets({ stimulus }: { stimulus: StudentStimulus }) {
  if (!stimulus.assets.length) return null
  return (
    <div className="space-y-3">
      {stimulus.assets.map((asset) => (
        <QuestionAsset key={asset.id} asset={asset} />
      ))}
    </div>
  )
}

/**
 * Shared stimulus renderer. Reading passages get long-form passage styling;
 * Thinking Skills / Maths supporting content gets a plain, high-contrast,
 * untinted block (or renders inline when it is only a sentence or two). No
 * content-type badge or colour tint is ever shown to a student.
 */
export function StimulusPanel({
  stimulus,
  variant,
  subjectName,
  showTypeLabel = false,
  className,
}: StimulusPanelProps) {
  const resolvedVariant = variant ?? resolveStimulusVariant(subjectName)
  const showTitle = shouldShowStimulusTitle(resolvedVariant, stimulus.stimulusType, stimulus.title)

  // Admin surfaces keep the internal type badge + title in a muted card so the
  // classification stays visible for review and filtering.
  if (showTypeLabel) {
    return (
      <div className={cn('space-y-3 rounded-2xl border border-border bg-muted/50 px-4 py-4', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STIMULUS_TYPE_LABELS[stimulus.stimulusType] ?? 'Stimulus'}</Badge>
          {stimulus.title ? (
            <p className="text-sm font-semibold text-foreground">{stimulus.title}</p>
          ) : null}
        </div>
        <QuestionMarkdown text={stimulus.bodyMarkdown} className="text-sm leading-7 text-foreground/80" />
        <StimulusAssets stimulus={stimulus} />
      </div>
    )
  }

  if (resolvedVariant === 'reading') {
    return (
      <div className={cn('space-y-3 rounded-2xl border border-border bg-card px-5 py-5', className)}>
        {showTitle ? (
          <h3 className="font-heading text-lg font-semibold text-foreground">{stimulus.title}</h3>
        ) : null}
        <QuestionMarkdown text={stimulus.bodyMarkdown} className="text-base leading-8 text-foreground" />
        <StimulusAssets stimulus={stimulus} />
      </div>
    )
  }

  // Supporting content. Short prose with nothing else renders inline (no box).
  const renderInline =
    !showTitle && !stimulus.assets.length && isInlineSupportingBody(stimulus.bodyMarkdown)

  if (renderInline) {
    return (
      <QuestionMarkdown
        text={stimulus.bodyMarkdown}
        className={cn('text-base leading-7 text-foreground', className)}
      />
    )
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card px-4 py-4', className)}>
      {showTitle ? (
        <p className="text-sm font-semibold text-foreground">{stimulus.title}</p>
      ) : null}
      <QuestionMarkdown text={stimulus.bodyMarkdown} className="text-base leading-7 text-foreground" />
      <StimulusAssets stimulus={stimulus} />
    </div>
  )
}
