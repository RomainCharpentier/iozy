import { useQueries, useQuery } from '@tanstack/react-query'
import { listEntityTypes } from '../api/entityTypes'
import { getGeneralBoard, listTierLists } from '../api/tierLists'
import { queryKeys } from './queryKeys'
import { boardCounts } from './tierListVisuals'
import type { EntityTypeDto } from '../types/api'
import type { GeneralBoardDto, TierListDto } from '../types/tierList'

const AUCUN_TYPE: EntityTypeDto[] = []
const AUCUNE_LISTE: TierListDto[] = []

export interface UniversTierList {
  entityType: EntityTypeDto
  board: GeneralBoardDto | undefined
  counts: { ranked: number; total: number }
  listes: TierListDto[]
}

/**
 * Les Tier Lists de l'utilisateur : un classement général par univers, plus
 * ses listes personnelles.
 *
 * <h2>Trois écrans, un seul chargement</h2>
 * L'aperçu de Découvrir, l'écran Tier Lists et la carte du Profil posaient les
 * mêmes requêtes - une par type d'œuvre pour le board, une par type pour les
 * listes, une pour les listes transverses - recopiées à l'identique sur une
 * vingtaine de lignes.
 *
 * <h2>Le défaut que ça referme</h2>
 * La carte du Profil ne chargeait PAS les listes « toutes catégories »
 * (Lot 14) : elle prétend montrer « Mes Tier Lists » avec un lien « Tout
 * voir », mais un utilisateur n'ayant que des listes transverses y aurait vu
 * une carte vide, quand l'écran Tier Lists et Découvrir les affichaient tous
 * les deux. Latent aujourd'hui - aucune liste n'existe encore - et refermé
 * avant qu'il ne se voie.
 */
export function useDonneesTierLists() {
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityTypes = entityTypesQuery.data ?? AUCUN_TYPE

  const boardQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.general(t.id),
      queryFn: () => getGeneralBoard(t.id),
    })),
  })
  const listsQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.custom(t.id),
      queryFn: () => listTierLists(t.id),
    })),
  })
  // Les listes « toutes catégories » n'appartiennent à aucun univers, et se
  // demandent donc à part (voir Lot 14).
  const crossUniverseQuery = useQuery({
    queryKey: queryKeys.tierLists.custom(null),
    queryFn: () => listTierLists(null),
  })

  const univers: UniversTierList[] = entityTypes.map((entityType, i) => ({
    entityType,
    board: boardQueries[i]?.data,
    counts: boardCounts(boardQueries[i]?.data),
    listes: listsQueries[i]?.data ?? AUCUNE_LISTE,
  }))

  const listesTransverses = crossUniverseQuery.data ?? AUCUNE_LISTE

  return {
    entityTypes,
    univers,
    listesTransverses,
    /** Toutes les listes perso, transverses comprises - c'est ce que l'écran
     *  Tier Lists et Découvrir montrent, et ce que le Profil oubliait. */
    toutesLesListes: [...univers.flatMap((u) => u.listes), ...listesTransverses],
    chargement:
      entityTypesQuery.isLoading ||
      boardQueries.some((q) => q.isLoading) ||
      listsQueries.some((q) => q.isLoading) ||
      crossUniverseQuery.isLoading,
    typesCharges: entityTypesQuery.isSuccess,
    erreur: entityTypesQuery.isError ? (entityTypesQuery.error as Error).message : null,
  }
}
