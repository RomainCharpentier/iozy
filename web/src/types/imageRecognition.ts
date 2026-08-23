/**
 * Reconnaissance visuelle : ce qu'IozyCore croit voir sur des photos.
 *
 * Ce sont des PROPOSITIONS. Rien de ce qui arrive ici n'a été écrit dans le
 * catalogue ni dans la collection — l'utilisateur confirme, corrige ou
 * supprime avant que quoi que ce soit n'entre dans une analyse.
 */

/** Trois niveaux nommés, jamais un pourcentage : aucun moteur n'est calibré. */
export type RecognitionConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type RecognitionStatus =
  /** Tout ce qui était visible a été identifié. */
  | 'OK'
  /** Une partie identifiée, une partie non — le cas courant sur un lot. */
  | 'PARTIAL'
  /** Le moteur a répondu mais n'a rien su lire. */
  | 'NOTHING_RECOGNIZED'
  /** Aucune photo exploitable (hôte non autorisé, format refusé, illisible). */
  | 'NO_USABLE_IMAGE'
  /** Aucun moteur configuré — IozyCore marche sans. */
  | 'NO_ENGINE'
  /** Panne, quota, délai dépassé — réessayer a du sens. */
  | 'UNAVAILABLE'

export type CatalogStatus =
  /** La série ET l'édition existent au catalogue. */
  | 'MATCHED'
  /** La série existe, l'édition reste à confirmer — jamais choisie d'office. */
  | 'EDITION_TO_CONFIRM'
  /** Reconnu, mais absent du catalogue. Rien n'a été créé. */
  | 'NOT_IN_CATALOG'

export interface EditionOptionDto {
  editionId: string
  editionName: string
  totalVolumes: number | null
}

export interface RecognizedItemDto {
  /** Le titre du catalogue s'il existe, sinon ce qui a été lu. */
  seriesTitle: string
  /** Ce que le moteur a lu, tel quel — pour que l'écart reste visible. */
  seriesTitleAsRead: string
  volumeNumber: number | null
  editionHint: string | null
  /** Un EAN a été lu : la lecture est exacte, pas approchante. */
  hasExactIdentifier: boolean
  confidence: RecognitionConfidence
  /** Pourquoi IozyCore propose ça, en clair. */
  evidence: string[]
  /** Index 0-based des photos qui ont soutenu la proposition. */
  sourceImages: number[]
  catalogStatus: CatalogStatus
  entityId: string | null
  editionOptions: EditionOptionDto[]
  /** L'écran peut pré-cocher — ce n'est jamais un droit d'écriture. */
  preselected: boolean
  readyForAnalysis: boolean
}

export interface AnalyzeImagesResponse {
  status: RecognitionStatus
  items: RecognizedItemDto[]
  /** Éléments vus mais non identifiés : à montrer, sinon le lot paraît plus petit. */
  unidentifiedCount: number
  notInCatalogCount: number
  analyzedImageCount: number
  requestedImageCount: number
}

export interface AnalyzeImagesRequest {
  imageUrls: string[]
  listingTitle?: string
  entityTypeCode?: string
}
