import { get, post, buildQuery } from './client'
import type { LookupResponse, WishlistEntryResponse } from '../types/api'

export function listWishlist(): Promise<WishlistEntryResponse[]> {
  return get<WishlistEntryResponse[]>('/wishlist')
}

export function addToWishlist(entityId: string): Promise<WishlistEntryResponse> {
  return post<WishlistEntryResponse>('/wishlist', { entityId })
}

export function lookupWishlistStatus(entityId: string): Promise<LookupResponse> {
  return get<LookupResponse>(`/wishlist/lookup${buildQuery({ entityId })}`)
}
