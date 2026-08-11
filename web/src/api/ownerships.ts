import { get, post, patch, buildQuery } from './client'
import type { OwnershipResponse } from '../types/api'

export function listOwnerships(entityId: string): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>(`/ownerships${buildQuery({ entityId })}`)
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
