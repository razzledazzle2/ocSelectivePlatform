/** Human-friendly duration, e.g. "1m 5s" or "45s". */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  if (minutes === 0) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

/** Countdown clock, e.g. "05:09" or "1:04:30". */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => value.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

/** "15 minutes", "1 hour", "1 hour 30 minutes". */
export function formatTimeLimit(totalSeconds: number): string {
  const minutesTotal = Math.round(totalSeconds / 60)
  const hours = Math.floor(minutesTotal / 60)
  const minutes = minutesTotal % 60
  const parts: string[] = []
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`)
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`)
  }
  return parts.join(' ') || '0 minutes'
}
