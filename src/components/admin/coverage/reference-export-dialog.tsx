'use client'

import { useState, useTransition } from 'react'
import { FileDownIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ReferenceExportStrategy } from '@/lib/coverage/core'
import {
  exportReferenceCsvAction,
  type ReferenceExportScope,
} from '@/app/admin/coverage/actions'

const STRATEGY_ITEMS: Record<ReferenceExportStrategy, string> = {
  all: 'All matching questions',
  limit: 'First N examples',
  balanced_difficulty: 'Balanced by difficulty',
  balanced_pattern: 'Balanced by pattern key',
}

/**
 * Reference-export dialog for a coverage row. Every option maps to a deterministic
 * filter — there is no AI generation here, only selection of existing questions.
 */
export function ReferenceExportDialog({
  scope,
  triggerLabel = 'Export reference CSV',
  triggerVariant = 'outline',
}: {
  scope: ReferenceExportScope
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost'
}) {
  const [open, setOpen] = useState(false)
  const [strategy, setStrategy] = useState<ReferenceExportStrategy>('all')
  const [limit, setLimit] = useState(12)
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [validatedOnly, setValidatedOnly] = useState(false)
  const [isPending, startTransition] = useTransition()

  const run = () => {
    startTransition(async () => {
      const result = await exportReferenceCsvAction(scope, {
        strategy,
        limit: strategy === 'all' ? undefined : limit,
        publishedOnly,
        validatedOnly,
      })
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to export.')
        return
      }
      const { csv, filename } = result.data
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(result.message ?? 'Export ready.')
      setOpen(false)
    })
  }

  return (
    <>
      <Button type="button" variant={triggerVariant} onClick={() => setOpen(true)}>
        <FileDownIcon className="size-4" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reference export</DialogTitle>
            <DialogDescription>
              Export matching questions as a full, re-importable CSV. Selection is deterministic —
              no AI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-strategy">Selection</Label>
              <Select
                value={strategy}
                onValueChange={(value) => setStrategy(value as ReferenceExportStrategy)}
                items={STRATEGY_ITEMS}
              >
                <SelectTrigger id="ref-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STRATEGY_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {strategy !== 'all' ? (
              <div className="space-y-1.5">
                <Label htmlFor="ref-limit">Number of examples</Label>
                <Input
                  id="ref-limit"
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={publishedOnly}
                  onChange={(event) => setPublishedOnly(event.target.checked)}
                />
                Published only
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={validatedOnly}
                  onChange={(event) => setValidatedOnly(event.target.checked)}
                />
                Validated only
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={run} disabled={isPending}>
              {isPending ? 'Preparing…' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
