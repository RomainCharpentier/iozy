import { get, post, patch, del } from './client'
import type { TagDto } from '@/common/types/api'

export function listTags(): Promise<TagDto[]> {
  return get<TagDto[]>('/tags')
}

/** Idempotent on the backend side: returns the existing tag if the label already exists. */
export function createTag(label: string): Promise<TagDto> {
  return post<TagDto>('/tags', { label })
}

export function attachTag(entityId: string, tagId: string): Promise<void> {
  return post<void>(`/tags/entities/${entityId}/${tagId}`)
}

/**
 * Rename a tag. 409 if the name is already taken - a label is unique.
 *
 * <p>Reserved for administrators, like all writes on tags:
 * a tag describes a WORK and lives in the shared catalog (see
 * TagController). It is the SERVER that enforces it (403); what the screens
 * do with `compte.admin` is avoid offering a closed door.
 */
export function renommerTag(id: string, label: string): Promise<TagDto> {
  return patch<TagDto>(`/tags/${id}`, { label })
}

/** Deletes the tag and removes it from all works. Final. */
export function supprimerTag(id: string): Promise<void> {
  return del<void>(`/tags/${id}`)
}

export function detachTag(entityId: string, tagId: string): Promise<void> {
  return del<void>(`/tags/entities/${entityId}/${tagId}`)
}
