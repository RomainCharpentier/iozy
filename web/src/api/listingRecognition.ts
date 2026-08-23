import { post } from './client'
import type { AnalyzeListingRequest, AnalyzeListingResponse } from '../types/listingRecognition'

/**
 * Détecte les éléments d'une annonce.
 *
 * Le titre et la description sont toujours lus, localement et sans coût.
 * `imageUrls` est le SEUL déclencheur d'un appel de moteur de vision : ne pas
 * le fournir garantit qu'aucune image ne part et qu'aucun euro n'est dépensé.
 */
export function analyzeListing(body: AnalyzeListingRequest): Promise<AnalyzeListingResponse> {
  return post<AnalyzeListingResponse>('/recognition/analyze', body)
}
