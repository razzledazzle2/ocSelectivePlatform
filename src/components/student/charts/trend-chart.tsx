import type { ProgressTrendPoint } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ProgressTrendChartProps {
  points: ProgressTrendPoint[]
  className?: string
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })

/**
 * Questions-answered volume (bars) with an accuracy line overlaid, sharing one
 * SVG viewport. Native <title> elements give every bar a hover tooltip; the
 * visually-hidden table below is the text equivalent for screen readers.
 */
export function ProgressTrendChart({ points, className }: ProgressTrendChartProps) {
  const activePoints = points.filter((point) => point.questions > 0)

  if (activePoints.length < 2) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Answer questions across a few more days and your trend will appear here.
      </p>
    )
  }

  const width = 300
  const height = 96
  const maxQuestions = Math.max(...points.map((point) => point.questions), 1)
  const step = points.length > 1 ? width / (points.length - 1) : width
  const barWidth = Math.max(2, step * 0.55)

  const accuracyPath = points
    .filter((point) => point.accuracy !== null)
    .map((point) => {
      const index = points.indexOf(point)
      const x = index * step
      const y = height - ((point.accuracy as number) / 100) * height
      return { x, y }
    })

  const linePath = accuracyPath
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const totalQuestions = points.reduce((sum, point) => sum + point.questions, 0)
  const summaryLabel = `Trend over ${points.length} days: ${totalQuestions} questions answered, accuracy ${
    activePoints[activePoints.length - 1]?.accuracy ?? '—'
  }% most recently.`

  return (
    <div className={cn('space-y-2', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={summaryLabel}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          className="stroke-border"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
        {points.map((point, index) => {
          const barHeight = (point.questions / maxQuestions) * height
          const x = index * step - barWidth / 2
          return (
            <rect
              key={point.dayKey}
              x={Math.max(0, x)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              className="fill-brand-soft"
            >
              <title>
                {dateFormatter.format(new Date(`${point.dayKey}T00:00:00`))}: {point.questions} question
                {point.questions === 1 ? '' : 's'}
                {point.accuracy !== null ? `, ${point.accuracy}% accuracy` : ''}
              </title>
            </rect>
          )
        })}
        <path
          d={linePath}
          fill="none"
          className="stroke-success"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-brand-soft" aria-hidden />
          Questions answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-success" aria-hidden />
          Accuracy
        </span>
      </div>
      <table className="sr-only">
        <caption>Daily questions answered and accuracy</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Questions answered</th>
            <th scope="col">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.dayKey}>
              <td>{point.dayKey}</td>
              <td>{point.questions}</td>
              <td>{point.accuracy === null ? 'No attempts' : `${point.accuracy}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
