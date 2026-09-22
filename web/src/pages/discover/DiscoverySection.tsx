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
 * Panneau « Découvertes » de Découvrir : ce que chaque univers sait proposer
 * à partir de ce qu'on possède.
 *
 * <h2>Ici, et plus dans Statistiques (lot 142)</h2>
 * Cette section vivait en bas de l'écran Statistiques, où rien ne la laissait
 * chercher ; et Découvrir, l'écran qui porte son nom, gardait à sa place un
 * panneau « Prochaines sorties » qui n'avait rien à dire - aucune source de
 * calendrier n'existe. Le panneau qui n'avait rien à dire est parti, celui-ci
 * prend sa place.
 *
 * <h2>Chaque univers branche le sien, le cœur ne sait rien d'eux</h2>
 * Le manga propose d'autres œuvres des mêmes auteurs que tes mieux notés, le
 * jeu vidéo des jeux proches de ceux que tu as, le jeu de société les jeux en
 * vue qui partagent leurs mécaniques. Un type sans source de découverte - un
 * type personnalisé - n'a pas de section : c'est le type qui le dit
 * (`hasDiscoverySource`), pas une liste de codes écrite ici.
 *
 * <p>À la demande : chaque univers interroge une source externe, et un écran
 * qui les lancerait toutes à l'ouverture coûterait plusieurs secondes à qui
 * venait seulement classer une Tier List.
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
  // Clé candidat (source+externalId) -> entityId créé, une fois ajouté.
  // Suivi par identité du candidat + id réellement créé plutôt que par
  // titre : une collision de titre marquerait à tort un autre élément
  // comme ajouté.
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
        // L'identifiant chez la source, pour que la fiche retrouve sa
        // jaquette et ses métadonnées : la clé dépend de la SOURCE, pas du
        // type - un même type peut en avoir plusieurs.
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
    // Un silence se lirait comme une panne : dire qu'il n'y a rien, et pour qui.
    return <p className="text-sm text-textDim">{entityType.label} : rien à proposer pour l'instant.</p>
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
                {/* La raison, toujours écrite : sinon c'est une page de promos. */}
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
