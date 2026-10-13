import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles } from 'lucide-react'
import { discover } from '@/common/api/insights'
import { quickAdd } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CLASSE_CARTE } from '@/common/components/Carte'
import type { DiscoveryCandidateDto, DiscoveryEmptyReason, EntityTypeDto } from '@/common/types/api'

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
 *
 * <h2>Silent source or nothing to offer (batch 159)</h2>
 * The server says which one it is (`sourceAnswered`, `emptyReason`). "La source
 * n'a pas répondu" and "Réessayer" appear only for an outage; "rien à proposer"
 * comes with its reason when the universe knows it.
 */
export function DiscoverySection() {
  const [demandees, setDemandees] = useState(false)
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const types = (entityTypesQuery.data ?? []).filter((t) => t.hasDiscoverySource)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Découvertes</h2>
      </div>

      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

      {entityTypesQuery.isSuccess && types.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Aucune de tes catégories n'a de source de découverte.</p>
        </div>
      )}

      {/* The waiting state is an invitation with its button inside, not a
          lone sentence with a link at the other end of the row: on a wide
          screen the two were 900 px apart and the section read as empty
          (UI review of 2026-10-13). */}
      {!demandees && types.length > 0 && (
        <div className={`${CLASSE_CARTE} flex flex-wrap items-center justify-between gap-3`}>
          <p className="min-w-0 flex-1 basis-64 text-sm text-textDim">
            Des œuvres proches de ce que tu possèdes, pour {types.map((t) => t.label).join(', ')}. Les sources ne
            sont interrogées que si tu le demandes.
          </p>
          <button type="button" onClick={() => setDemandees(true)} className="btn-secondaire shrink-0">
            <Sparkles size={14} />
            Voir des suggestions
          </button>
        </div>
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
  if (!discoveryQuery.data) return null
  const { candidates, sourceAnswered, emptyReason } = discoveryQuery.data

  const retryButton = (
    <button
      type="button"
      onClick={() => discoveryQuery.refetch()}
      disabled={discoveryQuery.isFetching}
      className="min-h-11 text-sm font-semibold text-accentText disabled:opacity-50"
    >
      {discoveryQuery.isFetching ? 'Nouvelle tentative…' : 'Réessayer'}
    </button>
  )

  if (candidates.length === 0) {
    // A silence would read as a failure: say that there is nothing, and why.
    // An outage is never said as "rien à proposer", and the reverse.
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm text-textDim">
          {sourceAnswered
            ? `${entityType.label} : rien à proposer. ${emptyReasonText(emptyReason)}`
            : `${entityType.label} : la source n'a pas répondu. Les suggestions reviendront quand elle répondra.`}
        </p>
        {!sourceAnswered && retryButton}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-textDim">{entityType.label}</h3>
      {!sourceAnswered && (
        <div className="flex flex-wrap items-center gap-x-3">
          <p className="text-sm text-textDim">Liste incomplète : la source n'a pas toujours répondu.</p>
          {retryButton}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => {
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

/** Why the universe had nothing to suggest, in words the user can act on. */
function emptyReasonText(reason: DiscoveryEmptyReason | null): string {
  switch (reason) {
    case 'NOTHING_OWNED':
      return "Tu n'as encore rien dans cette catégorie."
    case 'NO_RATED_WORK':
      return "Aucune œuvre notée : note celles que tu aimes, leurs auteurs serviront de piste."
    case 'NO_KNOWN_AUTHOR':
      return "Tes œuvres notées n'ont pas d'auteur renseigné."
    case 'NOT_LINKED_TO_SOURCE':
      return "Aucune n'a été ajoutée depuis la recherche : sans ce lien, la source n'a pas de piste."
    case null:
      return "La source a répondu, sans rien de nouveau pour toi."
  }
}
