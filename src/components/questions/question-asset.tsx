'use client'

import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'

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
 * 1. external_url → direct <img>.
 * 2. status 'uploaded' + storage_path → short-lived signed URL from the private
 *    question-media bucket (created client-side with the student's session).
 * 3. anything else (pending upload, failed load) → a clean placeholder card so
 *    rendering never breaks on missing media.
 *
 * Uses <span> wrappers (display:block) so it stays valid inside answer-option
 * <button> elements.
 */
export function QuestionAsset({ asset, className }: QuestionAssetProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const directUrl = asset.externalUrl
  const storagePath = asset.status === 'uploaded' ? asset.storagePath : null

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
          className="h-auto max-w-full rounded-xl border border-border bg-card"
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
