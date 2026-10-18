/**
 * Detection of the items of a listing: what IozyCore thinks it contains,
 * from its text and — if asked — its photos.
 *
 * These are PROPOSALS. Nothing was written in the catalog or in the
 * collection: the user confirms, corrects or deletes before anything enters
 * an analysis.
 */

/** Confidence in the READING. Never a percentage: no engine is calibrated. */
export type RecognitionConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Where a proposal comes from — a dimension distinct from confidence.
 * "The title announces volumes 1 to 14" is a certain reading of a
 * declarative source: sure about what is written, not about what the seller
 * owns.
 */
export type RecognitionSource = 'TEXT' | 'VISION' | 'EAN'

export type RecognitionStatus =
  | 'OK'
  | 'PARTIAL'
  | 'NOTHING_RECOGNIZED'
  | 'NO_USABLE_IMAGE'
  | 'NO_ENGINE'
  | 'QUOTA_EXCEEDED'
  | 'UNAVAILABLE'

export type CatalogStatus = 'MATCHED' | 'EDITION_TO_CONFIRM' | 'NOT_IN_CATALOG'

export interface EditionOptionDto {
  editionId: string
  editionName: string
  totalVolumes: number | null
}

/** A rectangle on a photo, as fractions of its width and height (0 to 1). */
export interface BoxDto {
  /** The photo, in sending order. */
  image: number
  top: number
  left: number
  bottom: number
  right: number
}

export interface RecognizedItemDto {
  /** The catalog title if it exists, otherwise what was read. */
  seriesTitle: string
  /** What was read, as it is — so that the gap stays visible. */
  seriesTitleAsRead: string
  volumeNumber: number | null
  editionHint: string | null
  hasExactIdentifier: boolean
  confidence: RecognitionConfidence
  /** In decreasing priority: EAN, then TEXT, then VISION. */
  sources: RecognitionSource[]
  /** The same, in plain words: "annonce", "photos", "code-barres". */
  sourceLabels: string[]
  evidence: string[]
  /** 0-based index of the photos. Empty for a proposal that came from the text alone. */
  sourceImages: number[]
  /** Where the book was seen: at most one frame per photo, often none (text, barcode). */
  boxes: BoxDto[]
  catalogStatus: CatalogStatus
  entityId: string | null
  editionOptions: EditionOptionDto[]
  preselected: boolean
  readyForAnalysis: boolean
}

export interface AnalyzeListingResponse {
  /** null when no photo was requested — not a failure, an absence of question. */
  visionStatus: RecognitionStatus | null
  items: RecognizedItemDto[]
  unidentifiedCount: number
  notInCatalogCount: number
  /** What the text alone produced: "the listing already describes N". */
  textItemCount: number
  analyzedImageCount: number
  requestedImageCount: number
  /**
   * What the listing claims to contain **without saying which ones** — "9
   * volumes of Naruto". `null` when it does not say, or when the numbers are
   * known (they then prevail).
   *
   * Deliberately **outside `items`**: unrolling 1 to 9 would build a purchase
   * verdict computed on volumes that nobody has seen — the seller may have
   * volumes 14 to 22.
   */
  announcedVolumeCount: number | null
  /** The series named in this case, `null` if the title designates none. */
  announcedSeriesTitle: string | null
}

export interface AnalyzeListingRequest {
  title?: string
  description?: string
  /** Absent = analysis of the text alone, so no engine call. */
  imageUrls?: string[]
  entityTypeCode?: string
}
