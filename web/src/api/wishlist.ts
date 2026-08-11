import { del, get, post } from './client'
import type { ShareLinkResponse, SharedWishlistEntryResponse, WishlistEntryResponse } from '../types/api'

export function listWishlist(): Promise<WishlistEntryResponse[]> {
  return get<WishlistEntryResponse[]>('/wishlist')
}

export function addToWishlist(entityId: string): Promise<WishlistEntryResponse> {
  return post<WishlistEntryResponse>('/wishlist', { entityId })
}

export function getShareLink(): Promise<ShareLinkResponse> {
  return get<ShareLinkResponse>('/wishlist/share')
}

export function generateShareLink(): Promise<ShareLinkResponse> {
  return post<ShareLinkResponse>('/wishlist/share')
}

export function removeShareLink(): Promise<void> {
  return del<void>('/wishlist/share')
}

/** Lecture seule, non authentifiée - voir PublicWishlistController côté backend. 404 si le lien n'existe pas ou a été supprimé. */
export function getSharedWishlist(token: string): Promise<SharedWishlistEntryResponse[]> {
  return get<SharedWishlistEntryResponse[]>(`/public/wishlist/${token}`)
}
