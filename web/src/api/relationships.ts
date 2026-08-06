import { get, post } from './client'
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
