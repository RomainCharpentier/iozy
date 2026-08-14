import { get, post, patch, del, buildQuery } from './client'
import type { OwnershipResponse } from '../types/api'

export function listOwnerships(entityId: string): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>(`/ownerships${buildQuery({ entityId })}`)
}

/** Toutes les Ownership, tous types confondus - pour calculer une progression
 * réelle (possédé, pas juste catalogué) par série sans une requête par série
 * (voir Ma collection). */
export function listAllOwnerships(): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>('/ownerships')
}

/** Suppression définitive (contrairement à markSold/markLost, des changements de
 * statut réversibles) - bloquée côté backend si un prêt référence encore cet
 * exemplaire (voir OwnershipDeletionService), même celui-ci déjà rendu. */
export function deleteOwnership(id: string): Promise<void> {
  return del<void>(`/ownerships/${id}`)
}

export function markSold(id: string): Promise<OwnershipResponse> {
  return post<OwnershipResponse>(`/ownerships/${id}/sell`)
}

export function markLost(id: string): Promise<OwnershipResponse> {
  return post<OwnershipResponse>(`/ownerships/${id}/lose`)
}

export function updateNote(id: string, note: string): Promise<OwnershipResponse> {
  return patch<OwnershipResponse>(`/ownerships/${id}/note`, { note })
}

/** purchasePrice null efface le prix renseigné (ex: saisie corrigée). */
export function updatePurchasePrice(id: string, purchasePrice: number | null): Promise<OwnershipResponse> {
  return patch<OwnershipResponse>(`/ownerships/${id}/purchase-price`, { purchasePrice })
}
