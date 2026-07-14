'use client'

import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'

import { resolveAssetRef } from '@/lib/assets/refs'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { StudentAssetRef } from '@/lib/types'

/** Private Supabase Storage bucket that holds question/stimulus media. */
const QUESTION_MEDIA_BUCKET = 'question-media'
const SIGNED_URL_TTL_SECONDS = 3600

interface QuestionAssetProps {
  asset: StudentAssetRef
  className?: string
}

/**
 * Renders a student-facing asset reference. Resolution order:
 * 1. external_url, or an external_ref that resolves to a public/external URL
 *    (generated SVGs served from /question-assets/…) → direct <img>.
 * 2. a storage_path on a usable asset → short-lived signed URL from the private
 *    question-media bucket (created client-side with the student's session).
 * 3. anything else (pending, failed load) → a clean placeholder card so
 *    rendering never breaks on missing media.
 *
 * Uses <span> wrappers (display:block) so it stays valid inside answer-option
 * <button> elements.
 */
const STORAGE_READY_STATUSES = new Set(['uploaded', 'approved', 'generated'])

export function QuestionAsset({ asset, className }: QuestionAssetProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // A generated/public asset resolves straight to a served URL with no signing.
  const resolvedRef = asset.externalRef ? resolveAssetRef(asset.externalRef) : null
  const publicUrl =
    resolvedRef && (resolvedRef.kind === 'public' || resolvedRef.kind === 'external') ? resolvedRef.url : null
  const directUrl = asset.externalUrl ?? publicUrl
  const storagePath = STORAGE_READY_STATUSES.has(asset.status) ? asset.storagePath : null

  useEffect(() => {
    if (directUrl || !storagePath) {
      return
    }

    let cancelled = false
    const supabase = createClient()

    supabase.storage
      .from(QUESTION_MEDIA_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.signedUrl) {
          setFailed(true)
          return
        }
        setSignedUrl(data.signedUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [directUrl, storagePath])

  const src = directUrl ?? signedUrl
  const altText = asset.altText?.trim() || ''
  const isResolvingSignedUrl = !directUrl && Boolean(storagePath) && !signedUrl && !failed

  if (src && !failed) {
    return (
      <span className={cn('block', className)}>
        {/* Signed/external URLs are dynamic, so next/image is not usable here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={altText}
          loading="lazy"
          className="h-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-border bg-card object-contain"
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center',
        isResolvingSignedUrl && 'animate-pulse',
        className
      )}
      role="img"
      aria-label={altText || 'Image unavailable'}
    >
      <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      <span className="block text-xs leading-5 text-muted-foreground">
        {altText || 'Image coming soon'}
      </span>
    </span>
  )
}
