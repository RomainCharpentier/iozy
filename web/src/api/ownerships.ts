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
