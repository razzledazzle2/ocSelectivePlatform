'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { generateMissingAssetsAction } from '@/app/admin/questions/asset-actions'
import { Button } from '@/components/ui/button'

interface GenerateMissingAssetsButtonProps {
  size?: 'sm' | 'default'
  variant?: 'outline' | 'secondary' | 'ghost' | 'default'
  className?: string
  /** Called after a run that generated at least one asset. */
  onGenerated?: () => void
}

/**
 * Bank-wide "Generate missing assets": renders every pending deterministic
 * diagram whose spec is supported and repoints its asset row to the generated
 * SVG. Unsupported assets are left pending with a count so nothing is hidden.
 */
export function GenerateMissingAssetsButton({
  size = 'sm',
  variant = 'outline',
  className,
  onGenerated,
}: GenerateMissingAssetsButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const result = await generateMissingAssetsAction()
      if (!result.success) {
        toast.error(result.message ?? 'Unable to generate missing assets.')
        return
      }
      const generated = result.data?.generatedCount ?? 0
      if (generated > 0) {
        toast.success(result.message ?? 'Assets generated.')
        router.refresh()
        onGenerated?.()
      } else {
        toast.info(result.message ?? 'No pending assets to generate.')
      }
    })
  }

  return (
    <Button size={size} variant={variant} className={className} disabled={isPending} onClick={run}>
      <SparklesIcon className="size-3.5" />
      {isPending ? 'Generating…' : 'Generate missing assets'}
    </Button>
  )
}
