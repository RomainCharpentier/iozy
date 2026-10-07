import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ReleaseRow } from '@/common/components/ReleaseRow'
import { Squelette } from '@/common/components/Squelette'
import { useLatestReleases } from './useLatestReleases'
import { ReleaseRefreshLine } from './ReleaseRefreshLine'

/**
 * "Dernières sorties" panel of Découvrir: the ten releases with the latest
 * dates, future or past, newest first, for what one follows, owns or wants. No
 * paging: "Tout voir" leads to the full calendar rather than duplicating it here.
 *
 * <p>Ten rows must neither fill the screen nor stretch over it: they are dense, and
 * from the tablet width on they read in two columns (the five newest on the left,
 * the next five on the right), so a title is never far from its relation.
 */
export function DiscoverReleasesPreview() {
  const calendrierQuery = useLatestReleases()
  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const libelleParType = new Map((typesQuery.data ?? []).map((t) => [t.id, t.label]))
  const sorties = calendrierQuery.data ?? []
  const retour = { to: '/discover', libelle: 'Découvrir' }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Dernières sorties</h2>
        <Link to="/releases" className="flex min-h-11 items-center text-sm font-semibold text-accentText">
          Tout voir
        </Link>
      </div>

      <ReleaseRefreshLine />

      {calendrierQuery.isError && <ErrorBanner message={calendrierQuery.error.message} />}
      {calendrierQuery.isLoading && <Squelette lignes={3} />}

      {calendrierQuery.isSuccess && sorties.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Aucune sortie annoncée pour ta collection ni tes envies.</p>
          <p className="mt-1 text-sm text-textDim">Ajoute une œuvre à ta collection ou à tes envies, ou suis-la depuis sa fiche, pour voir ses sorties ici.</p>
        </div>
      )}

      {sorties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-flow-col md:grid-cols-2 md:grid-rows-5 md:gap-x-8 [&>a:last-child]:border-b-0 md:[&>a:nth-child(5n)]:border-b-0">
          {sorties.map((entry) => (
            <ReleaseRow
              key={`${entry.entityId}|${entry.label}|${entry.date}`}
              entry={entry}
              typeLabel={libelleParType.get(entry.entityTypeId)}
              date={entry.date}
              retour={retour}
              dense
            />
          ))}
        </div>
      )}
    </div>
  )
}
