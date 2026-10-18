import { buildQuery, del, get, put } from './client'

/** The edition of a series that the user collects - see
 *  com.iozycore.domain.followededition on the backend side. */
export interface FollowedEditionDto {
  id: string
  entityId: string
  editionName: string
  followedAt: string
}

/**
 * A LIST, empty when nothing is followed, and not an object or a 404: "no
 * followed edition" is a normal state (a single-edition series has nothing to
 * choose), not an error. The contract spares every caller the
 * `retry: false` that `findEdition` already needs to neutralize its 404.
 */
export function listFollowedEdition(entityId: string): Promise<FollowedEditionDto[]> {
  return get<FollowedEditionDto[]>(`/followed-editions${buildQuery({ entityId })}`)
}

/** PUT: following an edition is idempotent, and replaces the one already followed -
 *  there are never two for the same series. */
export function followEdition(entityId: string, editionName: string): Promise<FollowedEditionDto> {
  return put<FollowedEditionDto>('/followed-editions', { entityId, editionName })
}

export function unfollowEdition(entityId: string): Promise<void> {
  return del<void>(`/followed-editions${buildQuery({ entityId })}`)
}
