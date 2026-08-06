import { get, post, del, buildQuery } from './client'
import type { EntityResponse, QuickAddRequest, QuickAddResponse } from '../types/api'

export function quickAdd(body: QuickAddRequest): Promise<QuickAddResponse> {
  return post<QuickAddResponse>('/entities/quick-add', body)
}

export function getEntity(id: string): Promise<EntityResponse> {
  return get<EntityResponse>(`/entities/${id}`)
}

export function listEntitiesByType(entityTypeId: string): Promise<EntityResponse[]> {
  return get<EntityResponse[]>(`/entities${buildQuery({ entityTypeId })}`)
}

/** q/entityTypeId/tagId sont tous optionnels - sans aucun, renvoie tout
 * (utilisé par l'écran Shelf comme "liste complète"). */
export function searchEntities(params: {
  q?: string
  entityTypeId?: string
  tagId?: string
}): Promise<EntityResponse[]> {
  return get<EntityResponse[]>(`/entities/search${buildQuery(params)}`)
}

export function deleteEntity(id: string): Promise<void> {
  return del<void>(`/entities/${id}`)
}
