// 1:1 mirror of the Java DTOs of the backend (same field names in camelCase -
// see backend/src/main/java/com/iozycore/api/dto/*.java and the domain
// records exposed directly, like Tag/Relationship). The LocalDate fields
// (acquiredAt, occurredAt, addedAt) travel as "YYYY-MM-DD", not as full
// ISO8601 - to be handled as simple strings, not as Date.

export type UUID = string
export type LocalDateString = string // "YYYY-MM-DD"

// --- Entity ---
// volumeNumber/edition are reserved for the "volume of a series" case (Manga):
// see QuickAddService on the backend side for the distinction series (Entity) /
// precise volume of an edition (Variant).
export interface QuickAddRequest {
  entityTypeId: UUID
  title: string
  condition: string
  attributes?: Record<string, unknown>
  volumeNumber?: number
  edition?: string
  // Cover of THIS precise volume (see VolumeCandidateDto), distinct from the
  // cover of the series possibly present in `attributes`.
  volumeImageUrl?: string
  // Optional, never guessed - stays editable afterwards (see ownerships.ts updatePurchasePrice).
  purchasePrice?: number
  /** One single use: canceling the removal of a volume by giving back its
   *  original date rather than replacing it with today (see EntityDetailPage).
   *  Absent = today, like any add. */
  acquiredAt?: string
}

export interface QuickAddResponse {
  entityId: UUID
  matchedExistingEntity: boolean
  variantId: UUID | null
  // An active Ownership already references this same Variant (this precise
  // volume) - never blocks the add (a 2nd copy of the same volume is
  // legitimate), only serves to warn the user.
  matchedExistingVariant: boolean
}

export interface VariantDto {
  id: UUID
  label: string
  attributes: Record<string, unknown>
  /** Catalog edition linked to this volume, when it is known (Series -> Edition -> Volume model). */
  mangaEditionId: UUID | null
}

export interface EntityResponse {
  id: UUID
  entityTypeId: UUID
  title: string
  attributes: Record<string, unknown>
  tagIds: UUID[]
  variants: VariantDto[]
  /** The `attributes` keys entered by hand: "Recharger depuis la
   *  source" does not overwrite them (Batch 130). */
  champsSaisis: string[]
}

// --- Ownership ---
export interface OwnershipResponse {
  id: UUID
  entityId: UUID
  variantId: UUID | null
  condition: string
  status: 'OWNED' | 'SOLD' | 'LOST'
  acquiredAt: LocalDateString
  note: string | null
  purchasePrice: number | null
}

// --- Experience ---
export interface RecordExperienceRequest {
  entityId: UUID
  // Optional: which precise volume this experience concerns (see Experience
  // on the backend side) - absent = the whole series, or a type without a notion of volume.
  variantId?: UUID
  experienceType: string
  occurredAt: LocalDateString
  rating?: number
  comment?: string
}

export interface ExperienceResponse {
  id: UUID
  entityId: UUID
  variantId: UUID | null
  experienceType: string
  occurredAt: LocalDateString
  rating: number | null
  comment: string | null
}

// --- Wishlist ---
export interface WishlistEntryResponse {
  /** The wanted VOLUME. Absent when the wish applies to the whole work - the
   *  case of types without a notion of volume, where the work IS the
   *  collectible object (see com.iozycore.domain.wishlist.WishlistEntry). */
  variantId?: UUID | null
  id: UUID
  entityId: UUID
  addedAt: LocalDateString
}

// --- Tag / Relationship (domain records exposed as they are) ---
export interface TagDto {
  id: UUID
  label: string
}

export interface RelationshipDto {
  id: UUID
  sourceEntityId: UUID
  targetEntityId: UUID
  relationshipType: string
}

// --- Insights ---
export interface TypeStatsDto {
  entityTypeCode: string
  entityTypeLabel: string
  entityCount: number
  activeOwnershipCount: number
  experienceCount: number
  averageRating: number | null
}

export interface TagCountDto {
  label: string
  count: number
}

export interface StatsSummaryDto {
  totalEntities: number
  totalActiveOwnerships: number
  wishlistCount: number
  experiencesThisYear: number
  byType: TypeStatsDto[]
  topTags: TagCountDto[]
}

/** "Évolution de ma collection" - one month, see StatsService.computeTimeline on the backend side.
 * month in the "YYYY-MM" format. Counts only, no monetary value. */
export interface MonthlyPointDto {
  month: string
  tomesAdded: number
}

export interface TypeCountDto {
  entityTypeLabel: string
  count: number
}

export interface TypeValueDto {
  entityTypeLabel: string
  knownValue: number
  pricedCount: number
  totalCount: number
}

/** "Calcul automatique de la valeur de la collection" (§15 V2) - see
 * StatsService.computeCollectionValue on the backend side. totalKnownValue is
 * NEVER the full real value: pricedOwnershipCount/totalActiveOwnershipCount
 * always tells how many ownerships have a price filled in. */
export interface CollectionValueDto {
  totalKnownValue: number
  pricedOwnershipCount: number
  totalActiveOwnershipCount: number
  byType: TypeValueDto[]
}

/** "Bilan annuel" - see StatsService.computeYearlyRecap on the backend side. No
 * public/unauthenticated endpoint: sharing is done by downloading the image generated on the client side. */
export interface YearlyRecapDto {
  year: number
  acquisitionsCount: number
  acquisitionsByType: TypeCountDto[]
  seriesStartedCount: number
  experiencesCount: number
  averageRating: number | null
  mostFeaturedCreator: string | null
  mostFeaturedCreatorCount: number
  availableYears: number[]
}

export interface DiscoveryCandidateDto {
  source: string
  externalId: string
  title: string
  imageUrl: string | null
  reason: string
}

/** Why a universe had nothing to ask its source (see Discovery.EmptyReason on the server). */
export type DiscoveryEmptyReason = 'NOTHING_OWNED' | 'NO_RATED_WORK' | 'NO_KNOWN_AUTHOR' | 'NOT_LINKED_TO_SOURCE'

export interface DiscoveryDto {
  candidates: DiscoveryCandidateDto[]
  /** False when the external source did not answer: an empty list then means "try again". */
  sourceAnswered: boolean
  /** Why nothing was asked of the source; null when it was asked. */
  emptyReason: DiscoveryEmptyReason | null
}

// --- Metadata ---
export interface MetadataCandidateDto {
  source: 'JIKAN' | 'MYANIMELIST' | 'ANILIST' | 'BGG' | 'IGDB' | 'OPEN_LIBRARY' | 'GOOGLE_BOOKS'
  externalId: string
  title: string
  imageUrl: string | null
  attributes: Record<string, unknown>
}

/** A precise volume of a real edition of a series (see VolumeCandidate
 * on the backend side) - for the visual selection of owned volumes. */
export interface VolumeCandidateDto {
  edition: string
  volumeNumber: number
  imageUrl: string | null
  title: string
  // An active Ownership already references the matching Variant (series already
  // present in the collection) - purely indicative, never blocks the
  // selection (a 2nd copy of the same volume remains possible).
  alreadyOwned: boolean
}

/** Response of GET /metadata/volumes (see VolumesResponse on the backend side) -
 * `quotaExceeded` tells an empty list "no edition found" apart from a
 * TRANSIENT failure of the provider: quota exceeded on all keys, or a
 * source that did not answer at all (503, timeout). In both cases
 * the screen must say "réessaie" rather than let people believe there is nothing.
 * The name of the field only speaks of the quota for compatibility (it is decoded as
 * it is by the iOS client) - on the server side it is named `providerUnavailable`. */
export interface VolumesResponseDto {
  volumes: VolumeCandidateDto[]
  quotaExceeded: boolean
}

/**
 * "How many owned volumes out of how many", computed BY THE SERVER.
 *
 * Mirror of com.iozycore.insights.CollectionProgress. The rule - notably the
 * attachment of volumes without a given edition to the only named edition of a
 * series - lives there and nowhere else: recomputing it here has already
 * produced two divergences (see docs/DESIGN_MIGRATION_V1.2.md, batches 31 and 49).
 */
export interface EditionProgressDto {
  /** `''` = the volumes without a given edition, when they form a separate group. */
  editionName: string
  sourceEditions: string[]
  ownedVolumeNumbers: number[]
  cataloguedVolumeNumbers: number[]
  /** null as long as the total of the edition is not filled in - never guessed. */
  totalVolumes: number | null
}

export interface CollectionProgressDto {
  entityId: UUID
  title: string
  editions: EditionProgressDto[]
  /** The edition that represents this work - null when it has no volume. */
  dominantEdition: EditionProgressDto | null
  ownedVolumeCount: number
}

// --- EntityType (dynamic type editor) ---
export interface EntityTypeDto {
  id: UUID
  code: string
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
  // At least one metadata provider (Jikan/BGG/IGDB) supports this
  // type - never the case for a custom type created through this editor.
  hasMetadataProvider: boolean
  /** The universe can offer discoveries from what one owns
   *  (same author, similar games, games in view...). It is the type that says so,
   *  never a list of codes in a screen (batch 142). */
  hasDiscoverySource: boolean
  /** The universe can date the releases of this category without them being
   *  entered (Google Books for volumes, IGDB for video games). Without a
   *  source, only the dates entered on a detail page enter the calendar
   *  (batch 146). */
  hasReleaseSource: boolean
  /** Chosen visual identity (see lib/entityTypeVisuals) - null = default visual.
   * KEYS, never colors: only the client knows how to translate them, and
   * only it knows how to adapt to the light/dark theme. */
  colorKey: string | null
  iconKey: string | null
  /** Cover format (see UNIVERSE_ASPECTS) - null = default format of the type. */
  aspectKey: string | null
}

export interface CreateEntityTypeRequest {
  code: string
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
  colorKey?: string
  iconKey?: string
  aspectKey?: string
}

/** The code can never be changed after creation (see EntityTypeService on the backend side). */
export interface UpdateEntityTypeRequest {
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
  /** Absent = back to the default visual: the caller sends the whole wanted
   * state, never a delta (see EntityTypeController.update). */
  colorKey?: string
  iconKey?: string
  aspectKey?: string
}

export interface BggImportResult {
  totalFound: number
  created: number
  matchedExisting: number
  failed: number
}

/** What an import would do (analysis) or just did (applied) - see ImportReport on the backend side. */
export interface ImportReport {
  applique: boolean
  sections: ImportSection[]
  remarques: ImportRemarque[]
  /** Beyond a ceiling, the remarks are no longer listed, only counted. */
  remarquesNonListees: number
}

export interface ImportSection {
  cle: string
  libelle: string
  crees: number
  rattaches: number
  ignores: number
}

export interface ImportRemarque {
  section: string
  genre: 'RATTACHE' | 'IGNORE' | 'REMPLACE'
  sujet: string
  detail: string
}

// --- Release calendar (batch 146) ---
export type ReleaseRelation = 'OWNED' | 'MISSING' | 'WANTED'

export interface ReleaseEntryDto {
  /** "2026-10-14" to the day, "2026-10" to the month - never a year alone. */
  date: string
  precision: 'DAY' | 'MONTH'
  entityId: UUID
  entityTitle: string
  entityTypeId: UUID
  /** What is released within the work ("Tome 42 · Kana"), empty when it is the work itself. */
  label: string
  volumeNumber: number | null
  editionName: string | null
  coverImageUrl: string | null
  /** What this release represents for the collection - always written. */
  relation: ReleaseRelation
  /** Where the date comes from: GOOGLE_BOOKS, IGDB, or MANUAL for a date entered on the detail page. */
  source: string
}

/** The latest releases, newest first - the server picks them, no period to give. */
export interface LatestReleasesDto {
  entries: ReleaseEntryDto[]
}

/** One pass of the refresh of the release dates (the night job, or a manual launch). */
export interface ReleaseRefreshRunDto {
  /** ISO instants. */
  startedAt: string
  finishedAt: string
  origin: 'SCHEDULED' | 'MANUAL'
  /** Series that were due for a re-read at the start of the pass. */
  stale: number
  refreshed: number
  /** Series still due after the pass. */
  remaining: number
  /** A provider went silent (quota, outage) and the pass stopped early. */
  stoppedOnUnavailableProvider: boolean
  /** What went wrong when the pass failed, otherwise null. */
  error: string | null
}

export interface ReleaseRefreshStatusDto {
  /** False when no universe can refresh its dates: nothing to launch. */
  available: boolean
  running: boolean
  lastRun: ReleaseRefreshRunDto | null
}

export interface ReleaseCalendarDto {
  from: string
  to: string
  entries: ReleaseEntryDto[]
}
