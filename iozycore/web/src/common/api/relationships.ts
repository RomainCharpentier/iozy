import { get, post, patch, del } from './client'
import type { RelationshipDto } from '@/common/types/api'

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
 * Corrects the TYPE of an existing relationship - the only correction that makes
 * sense: changing an end does not correct a relationship, it describes
 * another one (so you delete this one and create a good one).
 */
export function updateRelationshipType(id: string, relationshipType: string): Promise<RelationshipDto> {
  return patch<RelationshipDto>(`/relationships/${id}`, { relationshipType })
}

/** Removes the link only - neither of the two works is touched. Idempotent. */
export function deleteRelationship(id: string): Promise<void> {
  return del<void>(`/relationships/${id}`)
}
