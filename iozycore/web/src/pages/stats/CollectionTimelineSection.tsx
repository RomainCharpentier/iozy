import { useQuery } from '@tanstack/react-query'
import { getTimeline } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Squelette } from '@/common/components/Squelette'

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** "2026-03" -> "mars 26". */
function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-')
  const label = MONTH_LABELS[Number(monthNumber) - 1] ?? month
  return `${label} ${year.slice(2)}`
}

/** "Évolution de ma collection" (Statistiques) - number of volumes/copies
 * added per month, in pure CSS bars (no chart library, at the
 * scale of a personal collection it would bring nothing). Counts
 * only - no purchase price field exists on Ownership. */
export function CollectionTimelineSection() {
  const timelineQuery = useQuery({ queryKey: queryKeys.insights.timeline, queryFn: getTimeline })

  // A failed or slow load says so; only a truly empty timeline hides the section.
  if (timelineQuery.isError || timelineQuery.isPending) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Évolution de ma collection</h2>
        {timelineQuery.isError ? (
          <ErrorBanner message={`Évolution indisponible : ${timelineQuery.error.message}`} />
        ) : (
          <Squelette lignes={2} />
        )}
      </section>
    )
  }
  if (timelineQuery.data.length === 0) return null

  const points = timelineQuery.data
  const maxCount = Math.max(...points.map((p) => p.tomesAdded))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Évolution de ma collection</h2>
      <div className="defilement-discret overflow-x-auto">
        <div className="flex h-60 min-w-fit items-end gap-2">
          {points.map((point) => (
            <div key={point.month} className="flex min-w-10 flex-1 flex-col items-center gap-1.5">
              <span className="text-mention text-textDim tabular-nums">{point.tomesAdded}</span>
              <div
                title={`${point.tomesAdded} tome${point.tomesAdded > 1 ? 's' : ''} en ${formatMonth(point.month)}`}
                className="iozy-teinte w-full bg-vive"
                style={{ height: `${Math.max(4, (point.tomesAdded / maxCount) * 180)}px` }}
              />
              <span className="text-mention whitespace-nowrap text-faint">{formatMonth(point.month)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
