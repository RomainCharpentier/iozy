import { del, get, patch, post } from './client'
import type { ShareDto, SharedSpaceDto } from '../types/share'

/**
 * Le partage d'espace : UN lien, dont on choisit les sections visibles.
 *
 * Il y avait deux API distinctes - une pour la collection, une pour les envies -
 * produisant deux jetons : entrer par « Ma collection » ou par « Mes envies »
 * donnait deux URL différentes pour le même espace personnel. Ces fonctions
 * sont désormais les seules, quelle que soit la porte d'entrée.
 */
export function getShare(): Promise<ShareDto> {
  return get<ShareDto>('/share')
}

/** Régénère : l'ancien jeton cesse immédiatement de fonctionner, et les choix
 * repartent des plus fermés (Tier Lists exclues). */
export function generateShare(): Promise<ShareDto> {
  return post<ShareDto>('/share')
}

/**
 * Change les sections visibles sans toucher au lien déjà distribué. Chaque
 * champ omis reste inchangé, ce qui permet à un écran de ne piloter que sa
 * propre section. Tout décocher est refusé (400) : un lien qui n'expose rien
 * se supprime, il ne se vide pas.
 */
export function updateShare(sections: {
  shareCollection?: boolean
  shareWishlist?: boolean
  includeTierLists?: boolean
}): Promise<ShareDto> {
  return patch<ShareDto>('/share', sections)
}

export function removeShare(): Promise<void> {
  return del('/share')
}

/** Lecture publique, non authentifiée - 404 = lien inconnu ou révoqué (le
 * backend ne distingue jamais les deux). */
export function getSharedSpace(token: string): Promise<SharedSpaceDto> {
  return get<SharedSpaceDto>(`/public/share/${token}`)
}
