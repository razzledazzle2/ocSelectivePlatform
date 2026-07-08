'use client'

import { CheckCircle2Icon, ClockIcon, ImageOffIcon, SparklesIcon, XCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { resolveAssetRef } from '@/lib/assets/refs'
import { cn } from '@/lib/utils'
import type { AssetStatus, QuestionAssetLink } from '@/lib/types'

interface QuestionAssetStatusProps {
  assets: QuestionAssetLink[]
  className?: string
}

const STATUS_META: Record<
  AssetStatus | 'missing',
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; Icon: typeof ClockIcon }
> = {
  pending: { label: 'Pending asset', variant: 'outline', Icon: ClockIcon },
  generated: { label: 'Generated', variant: 'secondary', Icon: SparklesIcon },
  uploaded: { label: 'Uploaded', variant: 'secondary', Icon: CheckCircle2Icon },
  approved: { label: 'Approved', variant: 'default', Icon: CheckCircle2Icon },
  rejected: { label: 'Rejected', variant: 'destructive', Icon: XCircleIcon },
  archived: { label: 'Archived', variant: 'outline', Icon: ImageOffIcon },
  missing: { label: 'Missing asset', variant: 'destructive', Icon: ImageOffIcon },
}

/**
 * True when an asset row has no resolvable file yet — a pending placeholder, or
 * a non-pending ref that still points at nothing (no url / storage path).
 */
function isMissingFile(link: QuestionAssetLink): boolean {
  const { asset } = link
  if (asset.status === 'pending') return false // pending is its own state
  if (asset.external_url || asset.storage_path) return false
  if (asset.external_ref) {
    const resolved = resolveAssetRef(asset.external_ref)
    return resolved.kind === 'pending'
  }
  return true
}

/**
 * Admin-only panel summarising every asset linked to a question: a status badge
 * per asset, and a "how to generate" card for any that are still pending. Keeps
 * the pipeline visible to reviewers without leaving the question workspace.
 */
export function QuestionAssetStatus({ assets, className }: QuestionAssetStatusProps) {
  if (assets.length === 0) {
    return null
  }

  const pending = assets.filter((link) => link.asset.status === 'pending' || isMissingFile(link))

  return (
    <div className={cn('space-y-3 rounded-2xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Question assets</h3>
        {pending.length > 0 ? (
          <Badge variant="outline" className="gap-1 text-amber-700">
            <ClockIcon className="size-3" />
            {pending.length} pending
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2Icon className="size-3" />
            All ready
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {assets.map((link) => {
          const key = isMissingFile(link) ? 'missing' : link.asset.status
          const meta = STATUS_META[key] ?? STATUS_META.missing
          const { Icon } = meta
          return (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
            >
              <Badge variant={meta.variant} className="gap-1">
                <Icon className="size-3" />
                {meta.label}
              </Badge>
              <Badge variant="outline" className="uppercase">
                {link.role}
              </Badge>
              <Badge variant="outline">{link.asset.asset_type}</Badge>
              {link.asset.external_ref ? (
                <code className="truncate text-[0.7rem] text-muted-foreground">{link.asset.external_ref}</code>
              ) : null}
            </li>
          )
        })}
      </ul>

      {pending.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-900">
            Generate the pending diagram(s) before publishing — students cannot see placeholder text.
          </p>
          {pending.map((link) => (
            <div key={link.id} className="space-y-1.5 rounded-lg bg-white/70 p-2.5 text-xs">
              {link.asset.external_ref ? (
                <p className="font-mono text-[0.7rem] text-amber-900">{link.asset.external_ref}</p>
              ) : null}
              {link.asset.alt_text ? (
                <p className="text-foreground/80">
                  <span className="font-semibold">Alt text:</span> {link.asset.alt_text}
                </p>
              ) : null}
              {link.asset.generation_prompt ? (
                <p className="text-foreground/80">
                  <span className="font-semibold">Generation prompt:</span> {link.asset.generation_prompt}
                </p>
              ) : null}
            </div>
          ))}
          <p className="text-[0.7rem] leading-5 text-amber-900/80">
            Deterministic diagrams: add a spec to{' '}
            <code>docs/generated-question-bank/asset-specs/</code> and run{' '}
            <code>npm run generate:assets</code>, then re-import. Photos/scans: upload to the
            question-media bucket. See <code>docs/question-asset-pipeline.md</code>.
          </p>
        </div>
      ) : null}
    </div>
  )
}
