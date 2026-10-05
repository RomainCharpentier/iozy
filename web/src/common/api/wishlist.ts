import { del, get, post } from './client'
import type { WishlistEntryResponse } from '@/common/types/api'

export function listWishlist(): Promise<WishlistEntryResponse[]> {
  return get<WishlistEntryResponse[]>('/wishlist')
}

/**
 * What goes into the wishes: either a work that already has an IozyCore detail page, or
 * a work coming from an external source (metadata search, scan) that
 * does not have one yet.
 *
 * In the second case, the client sends what it knows - collection type,
 * title, and the attributes already retrieved (cover, author...) - and the backend
 * answers with the canonical internal identity: it decides whether
 * the work already existed or whether its detail page must be created. So the client does not
 * orchestrate "create then add", and two different sources cannot
 * produce two detail pages for the same work.
 *
 * No ownership is created in either case: the catalog
 * is not the collection.
 */
export type WishlistTarget =
  /**
   * A specific volume of a work that already has a detail page - the normal case for a manga,
   * since the wish applies to the really collectable object.
   *
   * Two ways to designate it: by `variantId` if it is already cataloged, by
   * its NUMBER otherwise. The second is by far the most frequent: on a
   * detail page, the missing volumes are deduced from the total of the edition and
   * most of them have never been cataloged. The backend then makes the
   * volume exist, without ownership (see TomeResolver).
   */
  | { entityId: string; variantId: string }
  | { entityId: string; volumeNumber: number; edition?: string }
  | { entityId: string }
  | { entityTypeId: string; title: string; attributes?: Record<string, unknown> }

export function addToWishlist(target: WishlistTarget): Promise<WishlistEntryResponse> {
  return post<WishlistEntryResponse>('/wishlist', target)
}

/** Removes an entry ("Remove from the wishlist" action) - targets only this entry, never the Series/
 * Edition/Volume nor an Ownership (see WishlistEntryRepository.deleteById on the backend side). Idempotent: an id
 * already removed does not return an error, so there is never a need to check existence before calling. */
export function removeFromWishlist(id: string): Promise<void> {
  return del<void>(`/wishlist/${id}`)
}
