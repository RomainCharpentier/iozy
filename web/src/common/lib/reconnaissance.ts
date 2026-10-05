import type { RecognitionConfidence, RecognitionStatus, RecognizedItemDto } from '@/common/types/listingRecognition'

/**
 * What two screens say about a reading of photos - the listing analysis and
 * the shelf import - and which must stay identical between them: the words
 * of confidence, the sentence of each reading outcome, and the identity of a
 * candidate.
 */

export const LIBELLES_CONFIANCE: Record<RecognitionConfidence, string> = {
  HIGH: 'confiance élevée',
  MEDIUM: 'confiance moyenne',
  LOW: 'piste incertaine',
}

export const COULEURS_CONFIANCE: Record<RecognitionConfidence, string> = {
  HIGH: 'text-ok',
  MEDIUM: 'text-textDim',
  LOW: 'text-warning',
}

export const RANG_CONFIANCE: Record<RecognitionConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

/**
 * Each outcome has its sentence. A single banner would confuse "these photos
 * show nothing readable" with "the service is broken", while the first one
 * is not retried and the second one is.
 */
export const MESSAGES_VISION: Record<RecognitionStatus, string> = {
  OK: '',
  PARTIAL: '',
  NOTHING_RECOGNIZED: "Les photos n'ont rien ajouté de lisible.",
  NO_USABLE_IMAGE: 'Aucune photo exploitable.',
  NO_ENGINE: "L'analyse des photos n'est pas configurée sur cette instance.",
  // A quota is not a failure: trying again within the minute will give
  // nothing, and saying so avoids three useless tries.
  QUOTA_EXCEEDED:
    "Le service d'analyse d'images a atteint son quota du jour. Réessaie demain, ou ajoute les tomes depuis le Catalogue.",
  UNAVAILABLE:
    "L'analyse des photos n'a pas pu aboutir : le service est saturé ou n'a pas répondu à temps. Réessaie dans quelques minutes.",
}

/**
 * The identity of a candidate, stable from one analysis to the next.
 *
 * This is the key of the corrections: neither the index in the list (which
 * moves as soon as a source adds an item), nor the corrected content.
 */
export function identite(item: RecognizedItemDto): string {
  return `${cleSerie(item)}|${item.volumeNumber ?? '?'}|${(item.editionHint ?? '').toLowerCase()}`
}

export function cleSerie(item: RecognizedItemDto): string {
  return item.seriesTitleAsRead.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
