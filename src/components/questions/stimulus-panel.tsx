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
  /**
   * Whether the external source URL is shown. Kept OFF on the active test
   * screen; turned ON in admin/review contexts.
   */
  showSourceUrl?: boolean
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
 * Passage attribution shown beneath the stimulus body. Author + source title +
 * attribution text always render; the external URL only when `showSourceUrl`.
 */
function StimulusAttributionLine({
  stimulus,
  showSourceUrl,
}: {
  stimulus: StudentStimulus
  showSourceUrl: boolean
}) {
  const attribution = stimulus.attribution
  if (!attribution) return null

  const bylineParts = [attribution.author, attribution.sourceTitle].filter(Boolean)
  const hasByline = bylineParts.length > 0
  const hasText = Boolean(attribution.attributionText)
  if (!hasByline && !hasText && !(showSourceUrl && attribution.sourceUrl)) {
    return null
  }

  return (
    <figcaption className="border-t border-border/60 pt-2 text-xs leading-5 text-muted-foreground">
      {hasByline ? (
        <span>
          {attribution.author ? <span className="font-medium text-foreground/70">{attribution.author}</span> : null}
          {attribution.author && attribution.sourceTitle ? ', ' : null}
          {attribution.sourceTitle ? <cite className="not-italic">{attribution.sourceTitle}</cite> : null}
        </span>
      ) : null}
      {hasText ? <span className={cn(hasByline && 'block')}>{attribution.attributionText}</span> : null}
      {showSourceUrl && attribution.sourceUrl ? (
        <a
          href={attribution.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-brand underline underline-offset-2"
        >
          {attribution.sourceUrl}
        </a>
      ) : null}
    </figcaption>
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
  showSourceUrl = false,
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
        <StimulusAttributionLine stimulus={stimulus} showSourceUrl={showSourceUrl} />
      </div>
    )
  }

  if (resolvedVariant === 'reading') {
    return (
      <figure className={cn('space-y-3 rounded-2xl border border-border bg-card px-5 py-5', className)}>
        {showTitle ? (
          <h3 className="font-heading text-lg font-semibold text-foreground">{stimulus.title}</h3>
        ) : null}
        <QuestionMarkdown text={stimulus.bodyMarkdown} className="text-base leading-8 text-foreground" />
        <StimulusAssets stimulus={stimulus} />
        <StimulusAttributionLine stimulus={stimulus} showSourceUrl={showSourceUrl} />
      </figure>
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
      <StimulusAttributionLine stimulus={stimulus} showSourceUrl={showSourceUrl} />
    </div>
  )
}
