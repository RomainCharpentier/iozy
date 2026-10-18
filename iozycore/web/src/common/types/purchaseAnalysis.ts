// 1:1 mirror of the Java DTOs/records of the Purchase Analysis module (see
// backend/src/main/java/com/iozycore/purchaseanalysis/**) - same convention
// as types/api.ts: fields in camelCase, LocalDate as "YYYY-MM-DD", Instant
// as a raw ISO string. File separate from types/api.ts to keep the latter
// at zero-touch (see the plan of the feature).

export type Condition = 'MINT_SEALED' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'ACCEPTABLE' | 'VISIBLE_DEFECTS'

export const CONDITIONS: Condition[] = ['MINT_SEALED', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE', 'VISIBLE_DEFECTS']

export const CONDITION_LABELS: Record<Condition, string> = {
  MINT_SEALED: 'Neuf sous blister',
  LIKE_NEW: 'Comme neuf',
  VERY_GOOD: 'Très bon état',
  GOOD: 'Bon état',
  ACCEPTABLE: 'État correct',
  VISIBLE_DEFECTS: 'Défauts visibles',
}

export type EditionTier = 'STANDARD' | 'DELUXE' | 'PRESTIGE' | 'PERFECT' | 'COLLECTOR' | 'INTEGRAL' | 'OTHER'

export const EDITION_TIERS: EditionTier[] = ['STANDARD', 'DELUXE', 'PRESTIGE', 'PERFECT', 'COLLECTOR', 'INTEGRAL', 'OTHER']

export const EDITION_TIER_LABELS: Record<EditionTier, string> = {
  STANDARD: 'Standard',
  DELUXE: 'Deluxe',
  PRESTIGE: 'Prestige',
  PERFECT: 'Perfect',
  COLLECTOR: 'Collector',
  INTEGRAL: 'Intégrale',
  OTHER: 'Autre',
}

export type ListingPlatform = 'VINTED' | 'LEBONCOIN' | 'RAKUTEN' | 'OTHER'

export const LISTING_PLATFORMS: ListingPlatform[] = ['VINTED', 'LEBONCOIN', 'RAKUTEN', 'OTHER']

export const LISTING_PLATFORM_LABELS: Record<ListingPlatform, string> = {
  VINTED: 'Vinted',
  LEBONCOIN: 'Leboncoin',
  RAKUTEN: 'Rakuten',
  OTHER: 'Autre',
}

export type Verdict = 'EXCELLENT_DEAL' | 'GOOD_DEAL' | 'FAIR_PRICE' | 'EXPENSIVE' | 'AVOID'

export type VerdictFactor =
  | 'FINAL_PRICE_VS_FAIR_VALUE'
  | 'RETAIL_DISCOUNT'
  | 'REAL_MARKET_ALIGNMENT'
  | 'CONDITION'
  | 'COMPLETENESS'
  | 'AVAILABILITY'
  | 'EDITION_QUALITY'
  | 'COST_TO_COMPLETE'
  | 'NEW_EDITION_RISK'
  | 'RARITY'

export type NegotiationAdvice = 'NEGOTIATE' | 'ACCEPTABLE_AS_IS' | 'SKIP_LISTING'

export type PriceBasis = 'OBSERVED_MARKET' | 'AI_ESTIMATED' | 'THEORETICAL_ONLY'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type WarningSeverity = 'INFO' | 'CAUTION' | 'CRITICAL'

export type WeightLevel = 'LOW' | 'MEDIUM' | 'HIGH'

// --- Requests ---

export interface ListingItemRequest {
  seriesTitle: string
  editionName: string
  includedVolumes: number[]
  itemConditionOverride?: Condition
}

export interface AnalyzeListingRequest {
  platform: ListingPlatform
  url?: string
  rawTitle: string
  /** Text of the listing - feeds the watch points. Absent, they stay silent. */
  description?: string
  askingPrice: number
  shippingFee?: number
  /** Without it, the server assumes UNKNOWN - never a firm rate. */
  shippingKind?: ShippingEstimateKind
  buyerProtectionFee?: number
  condition: Condition
  conditionAppliesToContainer: boolean
  items: ListingItemRequest[]
  photoUrls?: string[]
  /** Identifier returned by the reading of the link. Changes nothing in the calculation: it lets
   * us recognize two analyses of the same listing, so that an offer is not compared
   * with itself and does not count for several sellers. */
  externalListingId?: string
}

export interface CreateMangaEditionRequest {
  /** See migration "Série -> Édition par ID" - to be provided as soon as the caller knows
   * the Series with certainty (e.g. Series detail page), linked directly rather than found
   * by title matching. */
  entityId?: string
  seriesTitle: string
  editionName: string
  editionTier: EditionTier
  publisher?: string
  totalVolumes?: number
  retailPriceNewPerVolume?: number
  outOfPrint: boolean
  betterEditionAnnounced: boolean
  betterEditionNote?: string
}

export interface UpdateMangaEditionRequest {
  editionTier?: EditionTier
  publisher?: string
  totalVolumes?: number
  retailPriceNewPerVolume?: number
  outOfPrint?: boolean
  betterEditionAnnounced?: boolean
  betterEditionNote?: string
}

export interface RecordMarketObservationRequest {
  mangaEditionId: string
  volumeRangeStart?: number
  volumeRangeEnd?: number
  observedPrice: number
  platform: ListingPlatform
  observedCondition?: Condition
  observedAt: string // "YYYY-MM-DD"
  note?: string
}

// --- Responses (mirror of the domain records, exposed as they are) ---

export interface MangaEditionDto {
  id: string
  /** Link to the catalog Series (Entity) when it is known - nullable, never guessed (Series -> Edition -> Volume model). */
  entityId: string | null
  seriesTitle: string
  editionName: string
  tier: EditionTier
  publisher: string | null
  totalVolumes: number | null
  retailPriceNewPerVolume: number | null
  outOfPrint: boolean
  betterEditionAnnounced: boolean
  betterEditionNote: string | null
  languageCode: string
  createdAt: string
  updatedAt: string
}

export interface VolumeRangeDto {
  from: number
  to: number
}

/**
 * Where an observed price comes from. Neither a reliability hierarchy nor a
 * confidence level - both origins are worth the same, they are seen prices.
 * Used to know what we are looking at when a figure is surprising.
 */
export type MarketObservationOrigin = 'MANUAL_ENTRY' | 'LISTING_ANALYSIS'

export interface MarketPriceObservationDto {
  id: string
  mangaEditionId: string
  scope: VolumeRangeDto | null
  observedPrice: number
  platform: ListingPlatform
  observedCondition: Condition | null
  observedAt: string
  note: string | null
  createdAt: string
  origin: MarketObservationOrigin
  /** Volumes really concerned - prevails over `scope`, since a batch can be non-contiguous. */
  volumeCount: number | null
  /** Identity of the original listing; null for a manual entry. Several observations
   * with the same identity follow ONE offer over time, not several sellers. */
  listingIdentity: string | null
  sourceUrl: string | null
}

/** The profile that weights each analysis verdict. Five preferences were
 *  removed in Batch 84: no line of the engine read them. What remains is
 *  exactly what it reads. */
export interface CollectorPreferencesDto {
  editionTierRanking: EditionTier[]
  avoidOutdatedEditionWhenBetterExistsOrAnnounced: boolean
  conditionImportance: WeightLevel
  minimumDiscountVsRetailPercent: number
  factorWeights: Partial<Record<VerdictFactor, number>>
}

export interface MangaSeriesDto {
  title: string
  knownEntityId: string | null
}

export interface ListingItemDto {
  series: MangaSeriesDto
  editionNameRaw: string
  includedVolumes: number[]
  itemConditionOverride: Condition | null
}

export interface ListingDto {
  id: string
  platform: ListingPlatform
  url: string | null
  rawTitle: string
  shippingKind: ShippingEstimateKind
  askingPrice: number
  shippingFee: number
  buyerProtectionFee: number
  condition: Condition
  conditionAppliesToContainer: boolean
  items: ListingItemDto[]
  photoUrls: string[]
  requestedAt: string
}

export interface CollectionStatusDto {
  edition: MangaEditionDto | null
  totalVolumes: number | null
  missingCount: number | null
  missingVolumeNumbers: number[]
  /** Among missingVolumeNumbers, the volumes already cataloged (a Variant exists, just without
   * Ownership) rather than purely virtual (no Variant, Volume != Ownership model) - empty
   * if the caller did not provide cataloguedVolumes to GET /purchase-analysis/completeness. */
  cataloguedMissingVolumeNumbers: number[]
  estimatedCostToComplete: number | null
  costToCompleteBasis: PriceBasis | null
}

export interface MarketPriceDto {
  observationCount: number
  observedMedian: number | null
  observedLow: number | null
  observedHigh: number | null
  theoreticalEstimate: number | null
  basis: PriceBasis
  confidence: ConfidenceLevel
  /** Phase 2 (AI assistance) - non null only when basis === 'AI_ESTIMATED'. */
  aiEstimatedPrice: number | null
}

export interface WarningDto {
  severity: WarningSeverity
  message: string
  confidence: ConfidenceLevel
}

/** "Analyse d'un lot" (brainstorm) - duplicates between this ListingItem and the
 * volumes already owned (see DuplicateDetector on the backend side). Purely
 * advisory: never affects negotiation/verdict, whose calculation stays
 * exactly the one verified against the examples of the specification. */
export interface DuplicateAnalysisDto {
  duplicateVolumeNumbers: number[]
  usefulVolumeCount: number
  pricePerUsefulVolume: number | null
  maxWorthwhilePrice: number | null
}

export interface ItemAnalysisDto {
  item: ListingItemDto
  matchedEdition: MangaEditionDto | null
  completeness: CollectionStatusDto
  marketPrice: MarketPriceDto
  editionWarnings: WarningDto[]
  itemCostShare: number | null
  duplicates: DuplicateAnalysisDto
}

export interface FactorScoreDto {
  score: number
  rationale: string
  confidence: ConfidenceLevel
}

export interface NegotiationRecommendationDto {
  recommendedOffer: number | null
  targetPriceMin: number | null
  targetPriceMax: number | null
  maxPrice: number | null
  advice: NegotiationAdvice
  rationale: string
  priceDataAvailable: boolean
}

export interface PurchaseAnalysisDto {
  id: string
  requestedAt: string
  listing: ListingDto
  itemBreakdown: ItemAnalysisDto[]
  totalRealCost: number
  totalNewValue: number | null
  totalSavingsAmount: number | null
  discountPercent: number | null
  negotiation: NegotiationRecommendationDto
  verdict: Verdict
  verdictScore: number
  factorBreakdown: Partial<Record<VerdictFactor, FactorScoreDto>>
  warnings: WarningDto[]
  overallConfidence: ConfidenceLevel
  /** "Analyse d'un lot" - up to what price this batch stays interesting once the duplicates
   * are excluded - sum of the DuplicateAnalysisDto.maxWorthwhilePrice of each series. Null as long
   * as at least one series with useful volumes has no known price/volume. */
  totalMaxWorthwhilePrice: number | null
  /** The three dimensions of the listing - see ListingAssessmentDto. */
  assessment: ListingAssessmentDto
}

export interface PurchaseAnalysisSummaryDto {
  id: string
  createdAt: string
  listingTitle: string
  verdict: Verdict
  verdictScore: number
  totalRealCost: number
  seriesTitles: string[]
}

/** Phase 2 (AI assistance) - draft of an unknown edition to be
 * reviewed, never saved automatically (see AiEditionAdvisor on the
 * backend side). Absent (204) when no AI provider is configured. */
export interface EditionSuggestionDto {
  tier: EditionTier | null
  publisher: string | null
  totalVolumes: number | null
  retailPriceNewPerVolume: number | null
  outOfPrint: boolean | null
  betterEditionAnnounced: boolean | null
  betterEditionNote: string | null
  confidence: ConfidenceLevel
  rationale: string | null
}

/** "Suggestions d'achats" (Mon profil) - series already in the collection for which a
 * named edition is known but incomplete (see
 * PurchaseAnalysisService.findNearCompleteSuggestions on the backend side). */
export interface NearCompleteSuggestionDto {
  entityId: string
  seriesTitle: string
  editionName: string
  ownedCount: number
  totalVolumes: number
  missingCount: number
  missingVolumeNumbers: number[]
  /** Among missingVolumeNumbers, the volumes already cataloged (a Variant exists, just without
   * Ownership) rather than purely virtual (no Variant, Volume != Ownership model). */
  cataloguedMissingVolumeNumbers: number[]
  estimatedCostToComplete: number | null
  costToCompleteBasis: PriceBasis | null
}

// --- Reading a listing from its link (see ListingMetadataController) ---

/**
 * Outcome of an attempt to read a listing. Deliberately richer than a
 * boolean: the user does not have the same thing to do depending on the case,
 * and a single message would be useless in all five.
 *
 * - `SUCCESS` / `PARTIAL`: data was read (partially for the second one). In
 *   both cases we prefill what was found.
 * - `UNSUPPORTED_SOURCE`: platform not supported yet. The URL is kept,
 *   manual entry continues.
 * - `SOURCE_BLOCKS_AUTOMATION`: platform RECOGNIZED, but which refuses
 *   automatic reading (anti-robot protection). Not to be confused with the
 *   two neighbors: it is neither "not yet" (nothing is waiting for
 *   development) nor "try again" (a new attempt will fail the same way).
 *   Manual entry is not a temporary fallback, it is the path for this
 *   source.
 * - `LISTING_NOT_FOUND`: the listing no longer exists.
 * - `UNAVAILABLE`: the source delivered nothing usable.
 * - `INVALID_URL`: unusable link (the form catches it locally even before
 *   calling the server).
 */
export type ListingResolutionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_SOURCE'
  | 'SOURCE_BLOCKS_AUTOMATION'
  | 'LISTING_NOT_FOUND'
  | 'UNAVAILABLE'

/** The fields that a source can return - `retrievedFields` says which ones were REALLY read. */
/**
 * What the shipping amount kept for the listing is worth.
 *
 * `FROM` = "à partir de" (starting from): several modes exist and the source
 * displays the cheapest. The resulting total is then a MINIMUM, not a billed
 * cost - and the screen must say so.
 *
 * `ESTIMATED` = a usable but not guaranteed amount, typically entered by the
 * user. It counts in the cost, and the screen must absolutely not speak of
 * shipping "not communicated": it has just been communicated.
 *
 * `UNKNOWN` = no amount. The total is then INCOMPLETE: it is a subtotal,
 * not an acquisition cost.
 */
export type ShippingEstimateKind = 'FREE' | 'EXACT' | 'FROM' | 'ESTIMATED' | 'UNKNOWN'

export type ListingField =
  | 'TITLE'
  | 'DESCRIPTION'
  | 'PRICE'
  | 'SHIPPING_FEE'
  | 'BUYER_PROTECTION_FEE'
  | 'IMAGES'

export interface ListingPreviewDto {
  status: ListingResolutionStatus
  source: ListingPlatform
  url: string | null
  externalId: string | null
  title: string | null
  description: string | null
  price: number | null
  currency: string | null
  /** Announced shipping fee - "à partir de" price when several delivery modes
   * exist, and 0 when it is free. null = unreadable. */
  shippingFee: number | null
  /** What this amount is worth: free, firm, simple floor, or unreadable. */
  shippingKind: ShippingEstimateKind
  /** Buyer protection really billed (after a possible discount). */
  buyerProtectionFee: number | null
  imageUrls: string[]
  retrievedAt: string | null
  /** What was found. A field absent from here is never guessed. */
  retrievedFields: ListingField[]
}

// --- Assessment of a listing: three dimensions, then a synthesis ---

/** What the batch brings to THIS collection. */
export type CollectionInterest =
  | 'NOTHING_NEW'
  | 'MOSTLY_DUPLICATES'
  | 'PARTIALLY_USEFUL'
  | 'HIGHLY_USEFUL'
  | 'UNKNOWN'

export interface CollectionFitDto {
  detectedItemCount: number
  ownedItemCount: number
  missingItemCount: number
  wishlistedItemCount: number
  usefulItemCount: number
  /** null when the cost cannot be computed. */
  pricePerItem: number | null
  /** null when nothing is useful - we then do not display "0 € le tome utile". */
  pricePerUsefulItem: number | null
  interest: CollectionInterest
}

/** Where the price stands. `REFERENCE_UNAVAILABLE` = we do not judge, for lack of a reliable reference. */
export type PricePosition =
  | 'VERY_GOOD_PRICE'
  | 'GOOD_PRICE'
  | 'FAIR_PRICE'
  | 'RATHER_EXPENSIVE'
  | 'TOO_EXPENSIVE'
  | 'REFERENCE_UNAVAILABLE'

export type TrustSignal =
  | 'NO_PHOTO'
  | 'VERY_FEW_PHOTOS'
  | 'SHORT_DESCRIPTION'
  | 'OFF_PLATFORM_PAYMENT_MENTION'
  | 'PRICE_FAR_BELOW_REFERENCE'

/** Named levels, never a score out of 100: IozyCore does not measure a probability of fraud. */
export type TrustLevel =
  | 'NO_OBVIOUS_SIGNAL'
  | 'A_FEW_THINGS_TO_CHECK'
  | 'EXAMINE_CAREFULLY'
  | 'CONCERNING'

export interface ListingTrustAssessmentDto {
  level: TrustLevel
  signals: TrustSignal[]
}

export type AssessmentHeadline =
  | 'NOTHING_NEW_FOR_YOU'
  | 'LIMITED_INTEREST'
  | 'GOOD_FOR_YOUR_COLLECTION'
  | 'USEFUL_BUT_EXPENSIVE'
  | 'USEFUL_PRICE_UNKNOWN'
  | 'CHECK_BEFORE_BUYING'
  | 'CONTENT_TO_CONFIRM'

/**
 * The three dimensions kept distinct, plus the synthesis.
 *
 * They do not compensate each other: a batch sold off cheaply but entirely
 * made of duplicates is still a bad purchase at a good price, and the screen
 * must be able to say so.
 */
/**
 * What the market reference is worth, absence included. Only HIGH and MEDIUM
 * allow a price positioning: LOW says "we have something, but not enough to
 * decide", UNAVAILABLE that there is nothing.
 */
export type MarketReferenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE'

/**
 * Where the reference comes from. Only one source produces one: the prices
 * observed in IozyCore. Neither the AI estimate nor the new catalog price
 * becomes "the market" - they stay useful elsewhere (cost to complete,
 * negotiation, global verdict). `NOT_RECORDED`: analysis that predates this
 * recording.
 */
export type MarketReferenceSource = 'OBSERVED_COMPARABLES' | 'NONE' | 'NOT_RECORDED'

/** What is missing for a reference to exist - used to say what to do, not only that we do not know. */
export type ReferenceGap =
  | 'NONE'
  | 'EDITION_NOT_IN_CATALOGUE'
  | 'NO_OBSERVATION'
  | 'NO_COMPARABLE_SHAPE'
  | 'ONLY_STALE_OBSERVATIONS'
  | 'ONLY_CURRENT_LISTING'
  | 'INCOMPLETE_LOT_COVERAGE'
  | 'NOT_RECORDED'

export interface ListingAssessmentDto {
  collectionFit: CollectionFitDto
  pricePosition: PricePosition
  /** null as soon as the reference is not usable - a displayed figure is a figure that one believes. */
  referencePrice: number | null
  referenceConfidence: MarketReferenceConfidence
  /** Signed gap to the reference, as a percentage. */
  deviationPercent: number | null
  /** Comparable listings kept behind `referencePrice`; 0 when there are none. */
  referenceSampleSize: number
  referenceSource: MarketReferenceSource
  referenceGap: ReferenceGap
  /** High/low gap relative to the median. `null` under two comparables, or
   *  for an analysis that predates Batch 88. */
  referenceSpreadPercent: number | null
  /** The most recent of the kept observations - the freshness of the reference. */
  referenceMostRecentObservation: string | null
  /** Observations EXAMINED before filtering: to say "3 exist, 0 comparable"
   *  rather than "no data". 0 for an analysis that predates Batch 88. */
  referenceExaminedCount: number
  trust: ListingTrustAssessmentDto
  headline: AssessmentHeadline
}
