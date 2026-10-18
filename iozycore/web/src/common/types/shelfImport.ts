import type { RecognitionStatus, RecognizedItemDto } from './listingRecognition'

/**
 * Import of the library from photos of the shelf - the contract of
 * `/api/shelf-import`. The reading of a volume is THE ONE of the listing
 * analysis (`RecognizedItemDto`): the same engine, the same shape; this file
 * only describes what the shelf adds.
 */

/** The detail page that the sources propose for a series that is absent from the catalog. */
export interface FicheProposeeDto {
  source: string
  externalId: string
  title: string
  imageUrl: string | null
  attributes: Record<string, unknown>
}

export interface ShelfItemDto {
  /** The reading, as the listing analysis returns it. */
  item: RecognizedItemDto
  /**
   * A copy of this number is still owned, whatever the edition: the screen
   * shows it checked and inert, the import never rewrites it.
   */
  alreadyOwned: boolean
  /** `null` if the series is known, if nothing matches, or if the search was not done. */
  proposal: FicheProposeeDto | null
  /**
   * True when the title of the detail page matches what was read: kept by
   * default. False when it is only the first result of the search (French
   * title read, romaji detail page): shown as a lead, kept only if the user
   * says so.
   */
  proposalByTitle: boolean
}

export interface ShelfAnalysisDto {
  /** Never null here: photos were always sent. */
  visionStatus: RecognitionStatus
  items: ShelfItemDto[]
  unidentifiedCount: number
  notInCatalogCount: number
  analyzedImageCount: number
  requestedImageCount: number
  /** Unknown series for which no detail page was searched, for lack of budget. */
  lookupsSkipped: number
}

/** A volume confirmed by the user - same contract as the quick add. */
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
