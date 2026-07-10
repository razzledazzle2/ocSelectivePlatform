'use client'

import { DownloadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildCsvTemplate, CSV_TEMPLATE_FILENAME } from '@/lib/import/csv-template'

/** Downloads the blank v2 import template (client-side; no server round-trip). */
export function BlankTemplateButton({ variant = 'outline' }: { variant?: 'outline' | 'ghost' }) {
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8' })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = CSV_TEMPLATE_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button type="button" variant={variant} onClick={download}>
      <DownloadIcon className="size-4" />
      Blank template
    </Button>
  )
}
