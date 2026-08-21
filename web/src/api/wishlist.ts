import { del, get, post } from './client'
import type { WishlistEntryResponse } from '../types/api'

export function listWishlist(): Promise<WishlistEntryResponse[]> {
  return get<WishlistEntryResponse[]>('/wishlist')
}

/**
 * Ce qu'on met en envies : soit une œuvre qui a déjà une fiche IozyCore, soit
 * une œuvre venue d'une source externe (recherche de métadonnées, scan) qui
 * n'en a pas encore.
 *
 * Dans le second cas, le client envoie ce qu'il connaît - type de collection,
 * titre, et les attributs déjà récupérés (jaquette, auteur…) - et le backend
 * lui répond avec l'identité interne canonique : c'est lui qui décide si
 * l'œuvre existait déjà ou s'il faut créer sa fiche. Le client n'orchestre
 * donc pas « créer puis ajouter », et deux sources différentes ne peuvent pas
 * produire deux fiches pour la même œuvre.
 *
 * Aucune possession n'est créée dans un cas comme dans l'autre : le catalogue
 * n'est pas la collection.
 */
export type WishlistTarget =
  | { entityId: string }
  | { entityTypeId: string; title: string; attributes?: Record<string, unknown> }

export function addToWishlist(target: WishlistTarget): Promise<WishlistEntryResponse> {
  return post<WishlistEntryResponse>('/wishlist', target)
}

/** Retire une entrée (action "Retirer de la wishlist") - cible uniquement cette entrée, jamais la Série/
 * Édition/Tome ni une Ownership (voir WishlistEntryRepository.deleteById côté backend). Idempotent : un id
 * déjà retiré ne renvoie pas d'erreur, donc jamais besoin de vérifier l'existence avant d'appeler. */
export function removeFromWishlist(id: string): Promise<void> {
  return del<void>(`/wishlist/${id}`)
}
