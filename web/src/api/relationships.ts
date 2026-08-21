import { get, post, patch, del } from './client'
import type { RelationshipDto } from '../types/api'

export function createRelationship(body: {
  sourceEntityId: string
  targetEntityId: string
  relationshipType: string
}): Promise<RelationshipDto> {
  return post<RelationshipDto>('/relationships', body)
}

export function relationshipsFrom(entityId: string): Promise<RelationshipDto[]> {
  return get<RelationshipDto[]>(`/relationships/from/${entityId}`)
}

export function relationshipsTo(entityId: string): Promise<RelationshipDto[]> {
  return get<RelationshipDto[]>(`/relationships/to/${entityId}`)
}

/**
 * Corrige le TYPE d'une relation existante - la seule correction qui ait un
 * sens : changer une extrémité ne corrige pas une relation, c'est en décrire
 * une autre (on supprime alors celle-ci et on en crée une bonne).
 */
export function updateRelationshipType(id: string, relationshipType: string): Promise<RelationshipDto> {
  return patch<RelationshipDto>(`/relationships/${id}`, { relationshipType })
}

/** Retire le lien seul - aucune des deux œuvres n'est touchée. Idempotent. */
export function deleteRelationship(id: string): Promise<void> {
  return del<void>(`/relationships/${id}`)
}
