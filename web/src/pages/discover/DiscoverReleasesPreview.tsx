import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getReleaseCalendar } from '@/common/api/insights'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { periodeAVenir, phraseDeCouverture } from '@/common/lib/releaseDate'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ReleaseRow } from '@/common/components/ReleaseRow'

const MAX_PREVIEW = 3

/**
 * Panneau « Prochaines sorties » de Découvrir - de retour au lot 146, avec des
 * données cette fois : les trois premières sorties des trois mois à venir,
 * pour ce qu'on possède ou veut. « Tout voir » mène au calendrier complet,
 * même endpoint, plutôt que de dupliquer la liste ici (même montage que les
 * opportunités).
 */
export function DiscoverReleasesPreview() {
  const { from, to } = periodeAVenir(new Date())
  const calendrierQuery = useQuery({
    queryKey: queryKeys.insights.releases(from, to),
    queryFn: () => getReleaseCalendar(from, to),
  })
  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const libelleParType = new Map((typesQuery.data ?? []).map((t) => [t.id, t.label]))
  const sorties = (calendrierQuery.data?.entries ?? []).slice(0, MAX_PREVIEW)
  const retour = { to: '/discover', libelle: 'Découvrir' }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Prochaines sorties</h2>
        <Link to="/releases" className="flex min-h-11 items-center text-sm font-semibold text-accentText">
          Tout voir
        </Link>
      </div>

      {calendrierQuery.isError && <ErrorBanner message={calendrierQuery.error.message} />}
      {calendrierQuery.isLoading && <p className="text-sm text-textDim">Chargement...</p>}

      {calendrierQuery.isSuccess && sorties.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Rien d'annoncé pour les trois prochains mois.</p>
          {typesQuery.data && typesQuery.data.length > 0 && (
            <p className="mt-2 text-sm text-textDim">{phraseDeCouverture(typesQuery.data)}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sorties.map((entry) => (
          <ReleaseRow
            key={`${entry.entityId}|${entry.label}|${entry.date}`}
            entry={entry}
            typeLabel={libelleParType.get(entry.entityTypeId)}
            date={entry.date}
            retour={retour}
          />
        ))}
      </div>
    </div>
  )
}
