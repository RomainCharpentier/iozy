import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchEntities } from '@/common/api/entities'
import { listAllOwnerships } from '@/common/api/ownerships'
import { listEntityTypes } from '@/common/api/entityTypes'
import { getCollectionProgress } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { useWishlist } from '@/common/hooks/useWishlist'
import { useOeuvresSuivies } from '@/common/hooks/useOeuvresSuivies'
import { indexerProgression } from './shelfTiles'
import { ownedVariantIds } from '@/common/lib/ownership'
import type {
  CollectionProgressDto,
  EntityResponse,
  EntityTypeDto,
  OwnershipResponse,
} from '@/common/types/api'

// Stable references: `?? []` would build a new array at each render, and
// all the useMemo that depend on it would be recomputed for nothing.
const AUCUNE_OEUVRE: EntityResponse[] = []
const AUCUN_TYPE: EntityTypeDto[] = []
const AUCUNE_POSSESSION: OwnershipResponse[] = []
const AUCUNE_PROGRESSION: CollectionProgressDto[] = []

/**
 * Everything a collection screen needs to know - and nothing that it has to
 * reload itself.
 *
 * <h2>Two screens, one single collection</h2>
 * My collection and the category view made the same four queries,
 * declared the same four fallback constants, derived the same
 * ownerships and the same wishes, and composed the same "has everything arrived?"
 * - about thirty identical lines, copied. Two copies of a rule
 * always end up diverging: in batch 41, a tool of My collection started
 * to depend on the display filter without the category view
 * knowing it.
 *
 * <h2>What stays SPECIFIC to each screen</h2>
 * The filtering, the sort, the counters and the layout: this is where they
 * really differ. This hook only returns the data and their loading
 * state.
 */
export function useDonneesCollection() {
  const wishlist = useWishlist()
  const suivis = useOeuvresSuivies()

  const entitiesQuery = useQuery({
    queryKey: queryKeys.entities.search({}),
    queryFn: () => searchEntities({}),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const ownershipsQuery = useQuery({ queryKey: queryKeys.allOwnerships, queryFn: listAllOwnerships })
  // The "X out of Y" progress comes from the SERVER, in one call for the whole
  // collection - same source as the detail page, the purchase analysis and the
  // suggestions (see batches 51 and 60). Both screens share the query in
  // cache: opening it from the other one does not run it again.
  const progressQuery = useQuery({ queryKey: queryKeys.insights.progress, queryFn: getCollectionProgress })

  const entities = entitiesQuery.data ?? AUCUNE_OEUVRE
  const entityTypes = entityTypesQuery.data ?? AUCUN_TYPE
  const ownerships = ownershipsQuery.data ?? AUCUNE_POSSESSION

  const progression = useMemo(
    () => indexerProgression(progressQuery.data ?? AUCUNE_PROGRESSION),
    [progressQuery.data],
  )
  const owned = useMemo(() => ownedVariantIds(ownerships), [ownerships])
  const oeuvresSuivies = useMemo(() => new Set(suivis.suivies.map((s) => s.entityId)), [suivis.suivies])
  const oeuvresVoulues = useMemo(
    () => new Set(wishlist.entries.filter((e) => !e.variantId).map((e) => e.entityId)),
    [wishlist.entries],
  )

  return {
    entities,
    entityTypes,
    ownerships,
    progression,
    owned,
    oeuvresVoulues,
    oeuvresSuivies,
    tomesVoulus: wishlist.variantsVoulus,
    wishlist,
    /**
     * No number until EVERYTHING has arrived. Without this guard, the screen
     * announces an empty collection to someone who has one - observed by freezing
     * the API: "0 possédé ou voulu", filters at 0/0/0, while
     * "Chargement..." was displayed just below (batch 47).
     */
    chargement:
      entitiesQuery.isPending || ownershipsQuery.isPending || wishlist.isLoading || progressQuery.isPending,
    /** The list has really answered - "no work" is then not an admission
     *  of ignorance, and the empty message can be shown. */
    listeChargee: entitiesQuery.isSuccess,
    erreurs: [entitiesQuery, ownershipsQuery]
      .filter((q) => q.isError)
      .map((q) => (q.error as Error).message),
  }
}
