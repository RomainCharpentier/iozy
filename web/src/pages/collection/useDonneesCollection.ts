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

// Références stables : `?? []` fabriquerait un tableau neuf à chaque rendu, et
// tous les useMemo qui en dépendent se recalculeraient pour rien.
const AUCUNE_OEUVRE: EntityResponse[] = []
const AUCUN_TYPE: EntityTypeDto[] = []
const AUCUNE_POSSESSION: OwnershipResponse[] = []
const AUCUNE_PROGRESSION: CollectionProgressDto[] = []

/**
 * Tout ce qu'un écran de collection a besoin de savoir - et rien qu'il ait à
 * recharger lui-même.
 *
 * <h2>Deux écrans, une seule collection</h2>
 * Ma collection et la vue d'une catégorie posaient les mêmes quatre requêtes,
 * déclaraient les mêmes quatre constantes de repli, dérivaient les mêmes
 * possessions et les mêmes envies, et composaient le même « tout est arrivé ? »
 * - une trentaine de lignes identiques, recopiées. Deux copies d'une règle
 * finissent toujours par diverger : au Lot 41, un outil de Ma collection s'est
 * mis à dépendre du filtre d'affichage sans que la vue d'une catégorie le
 * sache.
 *
 * <h2>Ce qui reste PROPRE à chaque écran</h2>
 * Le filtrage, le tri, les compteurs et la mise en page : c'est là qu'ils
 * diffèrent vraiment. Ce hook ne rend que les données et leur état de
 * chargement.
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
  // La progression « X sur Y » vient du SERVEUR, en un appel pour toute la
  // collection - même source que la fiche, l'analyse d'achat et les
  // suggestions (voir Lots 51 et 60). Les deux écrans partagent la requête en
  // cache : l'ouvrir depuis l'autre ne la relance pas.
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
     * Aucun chiffre tant que TOUT n'est pas arrivé. Sans cette garde, l'écran
     * annonce une collection vide à quelqu'un qui en a une - constaté en gelant
     * l'API : « 0 possédé ou voulu », filtres à 0/0/0, pendant que
     * « Chargement... » s'affichait juste en dessous (Lot 47).
     */
    chargement:
      entitiesQuery.isPending || ownershipsQuery.isPending || wishlist.isLoading || progressQuery.isPending,
    /** La liste a vraiment répondu - « aucune œuvre » n'est alors pas un aveu
     *  d'ignorance, et le message de vide peut s'afficher. */
    listeChargee: entitiesQuery.isSuccess,
    erreurs: [entitiesQuery, ownershipsQuery]
      .filter((q) => q.isError)
      .map((q) => (q.error as Error).message),
  }
}
