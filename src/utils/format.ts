const shortDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const compactNumberFormatter = new Intl.NumberFormat('en-AU', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not yet'
  }

  return shortDateFormatter.format(new Date(value))
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'No data'
  }

  return `${value}%`
}

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value)
}
