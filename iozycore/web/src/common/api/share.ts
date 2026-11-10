import { del, get, patch, post, put } from './client'
import type { ShareDto, SharedSpaceDto, SharedValueDto } from '@/common/types/share'

/**
 * Space sharing: ONE link, whose visible sections you choose.
 *
 * There used to be two separate APIs - one for the collection, one for the wishes -
 * producing two tokens: entering through "Ma collection" or through "Mes envies"
 * gave two different URLs for the same personal space. These functions
 * are now the only ones, whatever the entry point.
 */
export function getShare(): Promise<ShareDto> {
  return get<ShareDto>('/share')
}

/** Regenerates: the old token stops working immediately, and the choices
 * start again from the most closed ones (Tier Lists excluded). */
export function generateShare(): Promise<ShareDto> {
  return post<ShareDto>('/share')
}

/**
 * Changes the visible sections without touching the link already handed out. Every
 * omitted field stays unchanged, which lets a screen drive only its
 * own section. Unchecking everything is refused (400): a link that exposes nothing
 * is deleted, it is not emptied.
 */
export function updateShare(sections: {
  shareCollection?: boolean
  shareWishlist?: boolean
  includeTierLists?: boolean
  showValue?: boolean
}): Promise<ShareDto> {
  return patch<ShareDto>('/share', sections)
}

export function removeShare(): Promise<void> {
  return del('/share')
}

/** Public read, not authenticated - 404 = unknown or revoked link (the
 * backend never tells the two apart). */
export function getSharedSpace(token: string): Promise<SharedSpaceDto> {
  return get<SharedSpaceDto>(`/public/share/${token}`)
}

// --- The "Partager" page (lot 217) ---

/** The public page as visitors see it, from the current choices (also before a link exists). */
export function getSharePreview(): Promise<SharedSpaceDto> {
  return get<SharedSpaceDto>('/share/preview')
}

/** The gift list page as visitors see it: the wishes only. */
export function getGiftPreview(): Promise<SharedSpaceDto> {
  return get<SharedSpaceDto>('/share/gift/preview')
}

/** The value of the collection when enough prices back it; null (204) when they do not. */
export async function getShareValue(): Promise<SharedValueDto | null> {
  return (await get<SharedValueDto | undefined>('/share/value')) ?? null
}

/** Replaces "Mes 4 incontournables", in order. 400 for a fifth, a duplicate or a work not owned. */
export function setPinnedWorks(entityIds: string[]): Promise<ShareDto> {
  return put<ShareDto>('/share/pins', { entityIds })
}

/** Creates the gift list link, or renews it for 30 days (same token). */
export function issueGiftLink(): Promise<ShareDto> {
  return post<ShareDto>('/share/gift')
}

export function removeGiftLink(): Promise<void> {
  return del('/share/gift')
}
