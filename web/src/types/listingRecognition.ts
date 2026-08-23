/**
 * Détection des éléments d'une annonce : ce qu'IozyCore croit qu'elle contient,
 * à partir de son texte et — si on le demande — de ses photos.
 *
 * Ce sont des PROPOSITIONS. Rien n'a été écrit dans le catalogue ni dans la
 * collection : l'utilisateur confirme, corrige ou supprime avant que quoi que
 * ce soit n'entre dans une analyse.
 */

/** Confiance dans la LECTURE. Jamais un pourcentage : aucun moteur n'est calibré. */
export type RecognitionConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * D'où vient une proposition — dimension distincte de la confiance.
 * « Le titre annonce les tomes 1 à 14 » est une lecture certaine d'une source
 * déclarative : sûre sur ce qui est écrit, pas sur ce que le vendeur possède.
 */
export type RecognitionSource = 'TEXT' | 'VISION' | 'EAN'

export type RecognitionStatus =
  | 'OK'
  | 'PARTIAL'
  | 'NOTHING_RECOGNIZED'
  | 'NO_USABLE_IMAGE'
  | 'NO_ENGINE'
  | 'UNAVAILABLE'

export type CatalogStatus = 'MATCHED' | 'EDITION_TO_CONFIRM' | 'NOT_IN_CATALOG'

export interface EditionOptionDto {
  editionId: string
  editionName: string
  totalVolumes: number | null
}

export interface RecognizedItemDto {
  /** Le titre du catalogue s'il existe, sinon ce qui a été lu. */
  seriesTitle: string
  /** Ce qui a été lu, tel quel — pour que l'écart reste visible. */
  seriesTitleAsRead: string
  volumeNumber: number | null
  editionHint: string | null
  hasExactIdentifier: boolean
  confidence: RecognitionConfidence
  /** Par priorité décroissante : EAN, puis TEXT, puis VISION. */
  sources: RecognitionSource[]
  /** Les mêmes, en clair : « annonce », « photos », « code-barres ». */
  sourceLabels: string[]
  evidence: string[]
  /** Index 0-based des photos. Vide pour une proposition venue du seul texte. */
  sourceImages: number[]
  catalogStatus: CatalogStatus
  entityId: string | null
  editionOptions: EditionOptionDto[]
  preselected: boolean
  readyForAnalysis: boolean
}

export interface AnalyzeListingResponse {
  /** null quand aucune photo n'a été demandée — pas un échec, une absence de question. */
  visionStatus: RecognitionStatus | null
  items: RecognizedItemDto[]
  unidentifiedCount: number
  notInCatalogCount: number
  /** Ce que le seul texte a produit : « l'annonce en décrit déjà N ». */
  textItemCount: number
  analyzedImageCount: number
  requestedImageCount: number
}

export interface AnalyzeListingRequest {
  title?: string
  description?: string
  /** Absent = analyse du texte seul, donc aucun appel de moteur. */
  imageUrls?: string[]
  entityTypeCode?: string
}
