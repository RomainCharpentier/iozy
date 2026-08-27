import { useQuery } from '@tanstack/react-query'
import { getTimeline } from '../../api/insights'
import { queryKeys } from '../../lib/queryKeys'

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** "2026-03" -> "mars 26". */
function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-')
  const label = MONTH_LABELS[Number(monthNumber) - 1] ?? month
  return `${label} ${year.slice(2)}`
}

/** "Évolution de ma collection" (Statistiques) - nombre de tomes/exemplaires
 * ajoutés par mois, en barres CSS pures (pas de librairie de graphes, à
 * l'échelle d'une collection personnelle ça n'apporterait rien). Comptages
 * uniquement - aucun champ de prix d'achat n'existe sur Ownership. */
export function CollectionTimelineSection() {
  const timelineQuery = useQuery({ queryKey: queryKeys.insights.timeline, queryFn: getTimeline })

  if (!timelineQuery.data || timelineQuery.data.length === 0) return null

  const points = timelineQuery.data
  const maxCount = Math.max(...points.map((p) => p.tomesAdded))

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Évolution de ma collection</h2>
      <div className="defilement-discret overflow-x-auto rounded-xl bg-surface p-3">
        <div className="flex h-32 min-w-fit items-end gap-2">
          {points.map((point) => (
            <div key={point.month} className="flex w-8 shrink-0 flex-col items-center gap-1">
              <span className="text-[10px] text-textDim">{point.tomesAdded}</span>
              <div
                title={`${point.tomesAdded} tome${point.tomesAdded > 1 ? 's' : ''} en ${formatMonth(point.month)}`}
                className="w-full rounded-t bg-accent"
                style={{ height: `${Math.max(4, (point.tomesAdded / maxCount) * 80)}px` }}
              />
              <span className="whitespace-nowrap text-[10px] text-textDim">{formatMonth(point.month)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
