import { get, post, patch, del } from './client'
import type { CreateEntityTypeRequest, EntityTypeDto, UpdateEntityTypeRequest } from '@/common/types/api'

export function listEntityTypes(): Promise<EntityTypeDto[]> {
  return get<EntityTypeDto[]>('/entity-types')
}

export function createEntityType(body: CreateEntityTypeRequest): Promise<EntityTypeDto> {
  return post<EntityTypeDto>('/entity-types', body)
}

export function updateEntityType(id: string, body: UpdateEntityTypeRequest): Promise<EntityTypeDto> {
  return patch<EntityTypeDto>(`/entity-types/${id}`, body)
}

/** Bloqué côté serveur (409) si des Entity de ce type existent encore. */
export function deleteEntityType(id: string): Promise<void> {
  return del<void>(`/entity-types/${id}`)
}
