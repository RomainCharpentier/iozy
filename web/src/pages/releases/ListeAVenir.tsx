import { useQuery } from '@tanstack/react-query'
import { getReleaseCalendar } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { LIBELLES_RELATION, libelleDateCourte, libelleMois, periodeSurUnAn } from '@/common/lib/releaseDate'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Jaquette } from '@/common/components/Jaquette'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import type { ReleaseEntryDto } from '@/common/types/api'
import { cleDeSortie, grouperParMois } from './releaseCalendar'
import { Squelette } from '@/common/components/Squelette'

/**
 * Tout ce qui vient dans l'année, mois par mois, dans l'ordre du calendrier
 * (lot 146, retour d'usage du 2026-09-10). La grille ne montre qu'un mois ;
 * cette liste répond à l'autre question - « qu'est-ce qui m'attend ? » - sans
 * tourner les pages. Une ligne ne mène pas à la fiche : elle amène la grille
 * sur son jour, où l'agenda du mois fait le reste.
 *
 * <p>Sa propre requête, sur un an moins un jour à partir d'aujourd'hui : le
 * mois affiché change, pas ce qui vient.
 */
export function ListeAVenir({
  libelleParType,
  onVoir,
  className = '',
}: {
  libelleParType: Map<string, string>
  /** Le mois à afficher (« 2026-11 »), et le jour à choisir quand la source le connaît. */
  onVoir: (mois: string, jour: string | null) => void
  className?: string
}) {
  const { from, to } = periodeSurUnAn(new Date())
  const query = useQuery({
    queryKey: queryKeys.insights.releases(from, to),
    queryFn: () => getReleaseCalendar(from, to),
  })
  const mois = grouperParMois(query.data?.entries ?? [])

  return (
    <aside aria-labelledby="a-venir-titre" className={`flex flex-col gap-4 ${className}`}>
      <div>
        <h2 id="a-venir-titre" className="font-display text-lg font-bold tracking-[-0.02em] text-textPrimary">
          À venir
        </h2>
        <p className="text-sm text-textDim">Tout ce qui sort dans l'année pour les œuvres que tu suis.</p>
      </div>

      {query.isError && <ErrorBanner message={query.error.message} />}
      {query.isLoading && <Squelette lignes={3} />}
      {query.isSuccess && mois.length === 0 && <p className="text-sm text-textDim">Rien d'annoncé pour l'année qui vient.</p>}

      {mois.map((m) => (
        <section key={m.mois} className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">{libelleMois(m.mois)}</h3>
          {m.entries.map((entry) => (
            <LigneAVenir key={cleDeSortie(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} onVoir={onVoir} />
          ))}
        </section>
      ))}
    </aside>
  )
}

function LigneAVenir({
  entry,
  typeLabel,
  onVoir,
}: {
  entry: ReleaseEntryDto
  typeLabel?: string
  onVoir: (mois: string, jour: string | null) => void
}) {
  const auJour = entry.precision === 'DAY'
  const sousTitre = entry.label || typeLabel || ''
  return (
    <button
      type="button"
      onClick={() => onVoir(entry.date.slice(0, 7), auJour ? entry.date : null)}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface"
    >
      <span className="w-16 shrink-0 text-xs font-semibold text-textDim">{auJour ? libelleDateCourte(entry.date) : 'à préciser'}</span>
      <Jaquette
        src={entry.coverImageUrl}
        className="h-10 w-7 shrink-0 rounded object-cover"
        repli={<span className="h-10 w-7 shrink-0 rounded bg-surface2" />}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <TexteCoupe texte={entry.entityTitle} className="truncate text-sm font-semibold text-textPrimary" />
        {sousTitre && <TexteCoupe texte={sousTitre} className="truncate text-xs text-textDim" />}
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-textDim">{LIBELLES_RELATION[entry.relation] ?? entry.relation}</span>
    </button>
  )
}
