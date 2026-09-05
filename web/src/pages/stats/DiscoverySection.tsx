import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles } from 'lucide-react'
import { discover } from '@/common/api/insights'
import { quickAdd } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { DiscoveryCandidateDto, EntityTypeDto } from '@/common/types/api'

/** Peut être lent (appels BGG/Jikan/IGDB) - pas de chargement automatique,
 * un bouton déclenche explicitement les 3 requêtes (MANGA, BOARD_GAME,
 * VIDEO_GAME - découverte limitée à ces 3 codes bien connus, un type créé
 * par l'utilisateur n'a pas de section découverte). */
export function DiscoverySection() {
  const [triggered, setTriggered] = useState(false)
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })

  const manga = entityTypesQuery.data?.find((t) => t.code === 'MANGA')
  const boardGame = entityTypesQuery.data?.find((t) => t.code === 'BOARD_GAME')
  const videoGame = entityTypesQuery.data?.find((t) => t.code === 'VIDEO_GAME')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Découverte</h2>
        {!triggered && (
          <button
            type="button"
            onClick={() => setTriggered(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-medium text-textDim hover:text-textPrimary"
          >
            <Sparkles size={16} />
            Voir des suggestions
          </button>
        )}
      </div>
      {triggered && (
        <div className="flex flex-col gap-4">
          {manga && <DiscoveryTypeList entityType={manga} />}
          {boardGame && <DiscoveryTypeList entityType={boardGame} />}
          {videoGame && <DiscoveryTypeList entityType={videoGame} />}
        </div>
      )}
    </section>
  )
}

function DiscoveryTypeList({ entityType }: { entityType: EntityTypeDto }) {
  const queryClient = useQueryClient()
  // Clé candidat (source+externalId) -> entityId créé, une fois ajouté.
  // Suivi par identité du candidat + id réellement créé plutôt que par
  // titre (contrairement à l'iOS, où une collision de titre marquerait à
  // tort un autre élément comme ajouté).
  const [added, setAdded] = useState<Record<string, string>>({})

  const discoveryQuery = useQuery({
    queryKey: queryKeys.insights.discover(entityType.code),
    queryFn: () => discover(entityType.code as 'MANGA' | 'BOARD_GAME' | 'VIDEO_GAME'),
  })

  const addMutation = useMutation({
    mutationFn: (candidate: DiscoveryCandidateDto) =>
      quickAdd({
        entityTypeId: entityType.id,
        title: candidate.title,
        condition: 'NEW',
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
  if (discoveryQuery.isLoading) return <p className="text-sm text-textDim">Chargement des suggestions {entityType.label}...</p>
  if (!discoveryQuery.data || discoveryQuery.data.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-textDim">{entityType.label}</h3>
      <ul className="flex flex-col gap-2">
        {discoveryQuery.data.map((candidate) => {
          const key = `${candidate.source}-${candidate.externalId}`
          const isAdded = key in added
          return (
            <li key={key} className="flex items-center justify-between rounded-xl bg-surface p-3">
              <div className="text-sm">
                <p className="text-textPrimary">{candidate.title}</p>
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
                  className="shrink-0 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
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
