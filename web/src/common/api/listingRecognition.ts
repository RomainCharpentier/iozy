import { post, postForm } from './client'
import type { AnalyzeListingRequest, AnalyzeListingResponse } from '@/common/types/listingRecognition'

/**
 * Detects the items of a listing.
 *
 * The title and the description are always read, locally and at no cost.
 * `imageUrls` is the ONLY trigger of a vision engine call: not providing it
 * guarantees that no image is sent and that no euro is spent.
 */
export function analyzeListing(body: AnalyzeListingRequest): Promise<AnalyzeListingResponse> {
  return post<AnalyzeListingResponse>('/recognition/analyze', body)
}

/** Eight at most: beyond that, each photo is one more engine call. */
export const MAX_PHOTOS_ENVOYEES = 8

/** 3 MB per photo, aligned with the server limit. */
export const MAX_OCTETS_PAR_PHOTO = 3 * 1024 * 1024

/**
 * Analysis of photos that the user provides themselves.
 *
 * The other path - `analyzeListing` with `imageUrls` - assumes that the photos
 * can be reached from the server. Three common situations do not allow it:
 * - a platform that refuses automatic reading (Leboncoin);
 * - a listing whose text names no series ("mangas of all kinds"),
 *   where the photos are the only source;
 * - a shelf photographed at home, which is nobody's listing.
 *
 * In all three cases the images are in front of the user; what was missing was
 * the way to give them. As for `imageUrls`, **sending is the
 * consent**: nothing is sent without this action.
 */
export function analyzeUploadedPhotos(
  photos: File[],
  contexte: { title?: string; description?: string; entityTypeCode?: string },
): Promise<AnalyzeListingResponse> {
  const form = new FormData()
  photos.forEach((photo) => form.append('photos', photo))
  if (contexte.title?.trim()) form.append('title', contexte.title.trim())
  if (contexte.description?.trim()) form.append('description', contexte.description.trim())
  if (contexte.entityTypeCode) form.append('entityTypeCode', contexte.entityTypeCode)
  return postForm<AnalyzeListingResponse>('/recognition/analyze-photos', form)
}
