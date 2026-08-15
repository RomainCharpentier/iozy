import { get, post, patch, del, buildQuery } from './client'
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

/** Complète/corrige les attributs de la Série elle-même sans écraser ceux
 * déjà renseignés (ex: jaquette de la série absente ou fausse, voir action
 * "Modifier" de la fiche Série) - même patron que mergeVariantAttributes,
 * au niveau Entity plutôt qu'un Variant imbriqué. */
export function mergeEntityAttributes(entityId: string, attributes: Record<string, unknown>): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}`, attributes)
}

/** Complète les attributs d'un Variant existant sans écraser ceux déjà
 * renseignés (ex: jaquette du tome retrouvée après coup, voir "Retrouver
 * les jaquettes manquantes" sur Ma collection). */
export function mergeVariantAttributes(
  entityId: string,
  variantId: string,
  attributes: Record<string, unknown>,
): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}/variants/${variantId}`, attributes)
}
