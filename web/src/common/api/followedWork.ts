import { buildQuery, del, get, put } from './client'

/** Une œuvre suivie : le troisième état, à côté de Possédé et Envie (voir
 *  WorkFollowing côté serveur). Un état à la fois : suivre retire l'envie de
 *  l'œuvre, vouloir l'œuvre ou la posséder d'une pièce retire le suivi. */
export interface FollowedWorkDto {
  entityId: string
  followedAt: string
}

export function listFollowedWorks(): Promise<FollowedWorkDto[]> {
  return get<FollowedWorkDto[]>('/followed-works')
}

/** PUT : suivre est idempotent - suivre deux fois, c'est suivre. */
export function followWork(entityId: string): Promise<FollowedWorkDto> {
  return put<FollowedWorkDto>('/followed-works', { entityId })
}

/** Idempotent aussi : ne plus suivre ce qu'on ne suivait pas ne renvoie pas d'erreur. */
export function unfollowWork(entityId: string): Promise<void> {
  return del<void>(`/followed-works${buildQuery({ entityId })}`)
}
