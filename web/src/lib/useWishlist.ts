import { useQuery } from '@tanstack/react-query'
import { listWishlist } from '../api/wishlist'
import { queryKeys } from './queryKeys'

/** Compte de la wishlist pour le badge Envies (voir DesktopHeader/TabBar) -
 * même clé de cache que WishlistPage, donc pas de double appel réseau quand
 * les deux sont montés (ex: retour sur Collection après avoir ouvert
 * Envies). `count: 0` tant que la requête n'a pas résolu plutôt qu'un badge
 * qui clignote au chargement. */
export function useWishlist(): { count: number } {
  const query = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })
  return { count: query.data?.length ?? 0 }
}
