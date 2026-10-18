import { get, del, buildQuery } from './client'
import type { OwnershipResponse } from '@/common/types/api'

export function listOwnerships(entityId: string): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>(`/ownerships${buildQuery({ entityId })}`)
}

/** All Ownership items, all types together - to compute a real progress
 * (owned, not just cataloged) per series without one request per series
 * (see Ma collection). */
export function listAllOwnerships(): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>('/ownerships')
}

/**
 * Permanent deletion of a copy. The backend can refuse it with 409;
 * its message is displayed as it is.
 *
 * <h2>The only write action that remains here</h2>
 * "Sold", "lost", "cancel", the rating of the copy and the price paid
 * each had their own function in this file - they lost their screen in
 * batches 53 to 55, and nobody called them anymore. The matching server routes
 * followed, except `/sell` and `/lose` which the iOS client still uses,
 * and `/restore` which cancels them (see OwnershipController).
 */
export function deleteOwnership(id: string): Promise<void> {
  return del<void>(`/ownerships/${id}`)
}
