import { get, post, del } from './client'
import type { TagDto } from '../types/api'

export function listTags(): Promise<TagDto[]> {
  return get<TagDto[]>('/tags')
}

/** Idempotent côté backend : renvoie le tag existant si le label existe déjà. */
export function createTag(label: string): Promise<TagDto> {
  return post<TagDto>('/tags', { label })
}

export function attachTag(entityId: string, tagId: string): Promise<void> {
  return post<void>(`/tags/entities/${entityId}/${tagId}`)
}

export function detachTag(entityId: string, tagId: string): Promise<void> {
  return del<void>(`/tags/entities/${entityId}/${tagId}`)
}
