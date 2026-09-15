import type { RecognitionStatus, RecognizedItemDto } from './listingRecognition'

/**
 * Import de la bibliothèque depuis des photos de l'étagère - le contrat de
 * `/api/shelf-import`. La lecture d'un tome est CELLE de l'analyse d'annonce
 * (`RecognizedItemDto`) : le même moteur, la même forme ; ce fichier ne
 * décrit que ce que l'étagère ajoute.
 */

/** La fiche que les sources proposent pour une série absente du catalogue. */
export interface FicheProposeeDto {
  source: string
  externalId: string
  title: string
  imageUrl: string | null
  attributes: Record<string, unknown>
}

export interface ShelfItemDto {
  /** La lecture, telle que l'analyse d'annonce la rend. */
  item: RecognizedItemDto
  /**
   * Un exemplaire de ce numéro est encore possédé, quelle que soit l'édition :
   * l'écran le montre coché et inerte, l'import ne le réécrit jamais.
   */
  alreadyOwned: boolean
  /** `null` si la série est connue, si rien ne correspond, ou si la recherche n'a pas été faite. */
  proposal: FicheProposeeDto | null
  /**
   * Vrai quand le titre de la fiche correspond à ce qui a été lu : gardée
   * d'office. Faux quand elle n'est que le premier résultat de la recherche
   * (titre français lu, fiche en romaji) : montrée comme une piste, gardée
   * seulement si l'utilisateur le dit.
   */
  proposalByTitle: boolean
}

export interface ShelfAnalysisDto {
  /** Jamais null ici : des photos ont toujours été envoyées. */
  visionStatus: RecognitionStatus
  items: ShelfItemDto[]
  unidentifiedCount: number
  notInCatalogCount: number
  analyzedImageCount: number
  requestedImageCount: number
  /** Séries inconnues pour lesquelles aucune fiche n'a été cherchée, faute de budget. */
  lookupsSkipped: number
}

/** Un tome confirmé par l'utilisateur - même contrat que l'ajout rapide. */
export interface TomeAImporter {
  seriesTitle: string
  volumeNumber: number
  edition?: string
  attributes?: Record<string, unknown>
  coverImageUrl?: string
}

export type IssueImport = 'ADDED' | 'ALREADY_OWNED'

export interface TomeImporteDto {
  seriesTitle: string
  volumeNumber: number
  edition: string | null
  outcome: IssueImport
  seriesCreated: boolean
  entityId: string
}

export interface RapportImportEtagereDto {
  items: TomeImporteDto[]
  added: number
  alreadyOwned: number
  seriesCreated: number
}
