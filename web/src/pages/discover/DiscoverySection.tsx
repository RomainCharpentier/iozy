import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles } from 'lucide-react'
import { discover } from '@/common/api/insights'
import { quickAdd } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CLASSE_CARTE } from '@/common/components/Carte'
import type { DiscoveryCandidateDto, EntityTypeDto } from '@/common/types/api'

/**
 * "Découvertes" panel of Découvrir: what each universe knows how to offer
 * from what one owns.
 *
 * <h2>Here, and no longer in Statistiques (batch 142)</h2>
 * This section lived at the bottom of the Statistiques screen, where nothing made one
 * look for it; and Découvrir, the screen that bears its name, kept in its place a
 * "Prochaines sorties" panel that had nothing to say - no calendar
 * source exists. The panel that had nothing to say is gone, this one
 * takes its place.
 *
 * <h2>Each universe plugs in its own, the core knows nothing about them</h2>
 * Manga offers other works by the same authors as your best rated, video
 * games offer games close to the ones you have, board games offer the games
 * in sight that share their mechanics. A type without a discovery source - a
 * custom type - has no section: the type says so
 * (`hasDiscoverySource`), not a list of codes written here.
 *
 * <p>On demand: each universe queries an external source, and a screen
 * that launched them all on opening would cost several seconds to whoever
 * only came to rank a Tier List.
 */
export function DiscoverySection() {
  const [demandees, setDemandees] = useState(false)
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const types = (entityTypesQuery.data ?? []).filter((t) => t.hasDiscoverySource)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Découvertes</h2>
        {!demandees && types.length > 0 && (
          <button
            type="button"
            onClick={() => setDemandees(true)}
            className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accentText"
          >
            <Sparkles size={14} />
            Voir des suggestions
          </button>
        )}
      </div>

      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

      {entityTypesQuery.isSuccess && types.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Aucune de tes catégories n'a de source de découverte.</p>
        </div>
      )}

      {!demandees && types.length > 0 && (
        <p className="text-sm text-textDim">
          À partir de ce que tu possèdes, pour {types.map((t) => t.label).join(', ')}. Les sources ne sont
          interrogées que si tu le demandes.
        </p>
      )}

      {demandees && (
        <div className="flex flex-col gap-4">
          {types.map((type) => (
            <DiscoveryTypeList key={type.id} entityType={type} />
          ))}
        </div>
      )}
    </div>
  )
}

function DiscoveryTypeList({ entityType }: { entityType: EntityTypeDto }) {
  const queryClient = useQueryClient()
  // Candidate key (source+externalId) -> entityId created, once added.
  // Tracked by candidate identity + really created id rather than by
  // title: a title collision would wrongly mark another item
  // as added.
  const [added, setAdded] = useState<Record<string, string>>({})

  const discoveryQuery = useQuery({
    queryKey: queryKeys.insights.discover(entityType.code),
    queryFn: () => discover(entityType.code),
  })

  const addMutation = useMutation({
    mutationFn: (candidate: DiscoveryCandidateDto) =>
      quickAdd({
        entityTypeId: entityType.id,
        title: candidate.title,
        condition: 'NEW',
        // The identifier at the source, so that the detail page finds its
        // cover and its metadata: the key depends on the SOURCE, not on the
        // type - a same type can have several.
        attributes:
          candidate.source === 'BGG'
            ? { bggId: candidate.externalId }
            : candidate.source === 'IGDB'
              ? { igdbId: candidate.externalId }
              : { malId: candidate.externalId },
      }),
    onSuccess: (result, candidate) => {
      setAdded((prev) => ({ ...prev, [`${candidate.source}-${candidate.externalId}`]: result.entityId }))
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  if (discoveryQuery.isError) return <ErrorBanner message={discoveryQuery.error.message} />
  if (discoveryQuery.isLoading) return <p className="text-sm text-textDim">Chargement des suggestions {entityType.label}…</p>
  if (!discoveryQuery.data || discoveryQuery.data.length === 0) {
    // A silence would read as a failure: say that there is nothing, and for whom.
    // The server cannot yet tell "nothing found" from "the source did not
    // answer" (a provider in outage returns an empty list): both are said,
    // never only "rien à proposer", which hid an outage.
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm text-textDim">
          {entityType.label} : aucune suggestion. Soit rien de ce que tu possèdes ne donne de piste, soit la source
          n'a pas répondu.
        </p>
        <button
          type="button"
          onClick={() => discoveryQuery.refetch()}
          disabled={discoveryQuery.isFetching}
          className="min-h-11 text-sm font-semibold text-accentText disabled:opacity-50"
        >
          {discoveryQuery.isFetching ? 'Nouvelle tentative…' : 'Réessayer'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-textDim">{entityType.label}</h3>
      <ul className="flex flex-col gap-2">
        {discoveryQuery.data.map((candidate) => {
          const key = `${candidate.source}-${candidate.externalId}`
          const isAdded = key in added
          return (
            <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
              <div className="min-w-0 text-sm">
                <p className="text-textPrimary">{candidate.title}</p>
                {/* The reason, always written: otherwise it is a page of promotions. */}
                <p className="text-textDim">{candidate.reason}</p>
              </div>
              {isAdded ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accentText">
                  <Check size={14} />
                  Ajouté
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => addMutation.mutate(candidate)}
                  disabled={addMutation.isPending}
                  className="btn-secondaire shrink-0"
                >
                  Ajouter
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
