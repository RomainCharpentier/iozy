import { buildQuery, del, get, put } from './client'

/** L'édition d'une série que l'utilisateur collectionne - voir
 *  com.iozycore.domain.followededition côté backend. */
export interface FollowedEditionDto {
  id: string
  entityId: string
  editionName: string
  followedAt: string
}

/**
 * Une LISTE, vide quand rien n'est suivi, et non un objet ou un 404 : « aucune
 * édition suivie » est un état normal (une série à édition unique n'a rien à
 * choisir), pas une erreur. Le contrat évite à chaque appelant le
 * `retry: false` qu'impose déjà `findEdition` pour neutraliser son 404.
 */
export function listFollowedEdition(entityId: string): Promise<FollowedEditionDto[]> {
  return get<FollowedEditionDto[]>(`/followed-editions${buildQuery({ entityId })}`)
}

/** PUT : suivre une édition est idempotent, et remplace celle déjà suivie -
 *  il n'y en a jamais deux pour une même série. */
export function followEdition(entityId: string, editionName: string): Promise<FollowedEditionDto> {
  return put<FollowedEditionDto>('/followed-editions', { entityId, editionName })
}

export function unfollowEdition(entityId: string): Promise<void> {
  return del<void>(`/followed-editions${buildQuery({ entityId })}`)
}
