import { useQueries, useQuery } from '@tanstack/react-query'
import { listEntityTypes } from '@/common/api/entityTypes'
import { getGeneralBoard, listTierLists } from '@/common/api/tierLists'
import { queryKeys } from '@/common/lib/queryKeys'
import { boardCounts } from '@/common/lib/tierListVisuals'
import type { EntityTypeDto } from '@/common/types/api'
import type { GeneralBoardDto, TierListDto } from '@/common/types/tierList'

const AUCUN_TYPE: EntityTypeDto[] = []
const AUCUNE_LISTE: TierListDto[] = []

export interface UniversTierList {
  entityType: EntityTypeDto
  board: GeneralBoardDto | undefined
  counts: { ranked: number; total: number }
  listes: TierListDto[]
}

/**
 * The Tier Lists of the user: one general ranking per universe, plus
 * their personal lists.
 *
 * <h2>Three screens, one single load</h2>
 * The Discover preview, the Tier Lists screen and the Profile card made the
 * same requests - one per work type for the board, one per type for the
 * lists, one for the cross-cutting lists - copied identically over about
 * twenty lines.
 *
 * <h2>The flaw this closes</h2>
 * The Profile card did NOT load the "all categories" lists (Batch 14): it
 * claims to show "Mes Tier Lists" with a "Tout voir" link, but a user who
 * only had cross-cutting lists would have seen an empty card there, while
 * the Tier Lists screen and Discover both displayed them. Latent today - no
 * list exists yet - and closed before it could be seen.
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
  // The "all categories" lists do not belong to any universe, and are
  // therefore requested separately (see Batch 14).
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
    /** All the personal lists, cross-cutting ones included - this is what the
     *  Tier Lists screen and Discover show, and what the Profile forgot. */
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
