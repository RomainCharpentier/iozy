import { get, post, patch, del } from './client'
import type { TagDto } from '@/common/types/api'

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

/**
 * Renommer un tag. 409 si le nom est déjà pris - un libellé est unique.
 *
 * <p>Réservé aux administrateurs, comme toutes les écritures sur les tags :
 * un tag décrit une ŒUVRE et vit dans le catalogue partagé (voir
 * TagController). C'est le SERVEUR qui l'impose (403) ; ce que les écrans
 * font de `compte.admin`, c'est éviter de proposer une porte fermée.
 */
export function renommerTag(id: string, label: string): Promise<TagDto> {
  return patch<TagDto>(`/tags/${id}`, { label })
}

/** Supprime le tag et le retire de toutes les œuvres. Définitif. */
export function supprimerTag(id: string): Promise<void> {
  return del<void>(`/tags/${id}`)
}

export function detachTag(entityId: string, tagId: string): Promise<void> {
  return del<void>(`/tags/entities/${entityId}/${tagId}`)
}
