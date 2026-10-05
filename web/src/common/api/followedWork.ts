import { buildQuery, del, get, put } from './client'

/** A followed work: the third state, next to Owned and Wish (see
 *  WorkFollowing on the server side). One state at a time: following removes the work's
 *  wish, wanting the work or owning one piece of it removes the follow. */
export interface FollowedWorkDto {
  entityId: string
  followedAt: string
}

export function listFollowedWorks(): Promise<FollowedWorkDto[]> {
  return get<FollowedWorkDto[]>('/followed-works')
}

/** PUT: following is idempotent - following twice is following. */
export function followWork(entityId: string): Promise<FollowedWorkDto> {
  return put<FollowedWorkDto>('/followed-works', { entityId })
}

/** Idempotent too: unfollowing what was not followed does not return an error. */
export function unfollowWork(entityId: string): Promise<void> {
  return del<void>(`/followed-works${buildQuery({ entityId })}`)
}
