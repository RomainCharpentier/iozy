import { get, post } from './client'
import type { WishlistEntryResponse } from '../types/api'

export function listWishlist(): Promise<WishlistEntryResponse[]> {
  return get<WishlistEntryResponse[]>('/wishlist')
}

export function addToWishlist(entityId: string): Promise<WishlistEntryResponse> {
  return post<WishlistEntryResponse>('/wishlist', { entityId })
}
