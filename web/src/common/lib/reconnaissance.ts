import type { RecognitionConfidence, RecognitionStatus, RecognizedItemDto } from '@/common/types/listingRecognition'

/**
 * Ce que deux écrans disent d'une lecture de photos - l'analyse d'annonce et
 * l'import d'étagère - et qui doit rester identique entre eux : les mots de la
 * confiance, la phrase de chaque issue de lecture, et l'identité d'un candidat.
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
 * Chaque issue a sa phrase. Un bandeau unique confondrait « ces photos ne
 * montrent rien de lisible » avec « le service est cassé », alors que la
 * première ne se réessaie pas et la seconde si.
 */
export const MESSAGES_VISION: Record<RecognitionStatus, string> = {
  OK: '',
  PARTIAL: '',
  NOTHING_RECOGNIZED: "Les photos n'ont rien ajouté de lisible.",
  NO_USABLE_IMAGE: 'Aucune photo exploitable.',
  NO_ENGINE: "L'analyse des photos n'est pas configurée sur cette instance.",
  UNAVAILABLE: "L'analyse des photos n'a pas pu aboutir. Vous pouvez réessayer.",
}

/**
 * L'identité d'un candidat, stable d'une analyse à l'autre.
 *
 * C'est la clé des corrections : ni l'index dans la liste (qui bouge dès qu'une
 * source ajoute un élément), ni le contenu corrigé.
 */
export function identite(item: RecognizedItemDto): string {
  return `${cleSerie(item)}|${item.volumeNumber ?? '?'}|${(item.editionHint ?? '').toLowerCase()}`
}

export function cleSerie(item: RecognizedItemDto): string {
  return item.seriesTitleAsRead.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
