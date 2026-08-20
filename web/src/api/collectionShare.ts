import { del, get, patch, post } from './client'
import type { CollectionShareDto, SharedCollectionDto } from '../types/collectionShare'

/** "Partager ma collection" (voir CollectionShareController côté backend) -
 * même mécanique de lien secret que la wishlist (voir api/wishlist.ts), avec
 * en plus l'interrupteur "partager aussi mes Tier Lists". Les deux liens sont
 * indépendants : révoquer l'un ne touche jamais l'autre. */
export function getCollectionShare(): Promise<CollectionShareDto> {
  return get<CollectionShareDto>('/collection/share')
}

/** Régénère : l'ancien jeton cesse immédiatement de fonctionner, et le
 * partage des Tier Lists repart désactivé (choix le plus fermé). */
export function generateCollectionShare(): Promise<CollectionShareDto> {
  return post<CollectionShareDto>('/collection/share')
}

/** Bascule le partage des Tier Lists sans toucher au lien déjà distribué. */
export function setCollectionShareTierLists(includeTierLists: boolean): Promise<CollectionShareDto> {
  return patch<CollectionShareDto>('/collection/share', { includeTierLists })
}

export function removeCollectionShare(): Promise<void> {
  return del('/collection/share')
}

/** Lecture publique, non authentifiée - 404 = lien inconnu ou révoqué (voir
 * PublicCollectionController : jamais un message qui distingue les deux). */
export function getSharedCollection(token: string): Promise<SharedCollectionDto> {
  return get<SharedCollectionDto>(`/public/collection/${token}`)
}
