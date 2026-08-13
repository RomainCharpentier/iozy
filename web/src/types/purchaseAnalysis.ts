// Miroir 1:1 des DTOs/records Java du module Purchase Analysis (voir
// backend/src/main/java/com/iozycore/purchaseanalysis/**) - même convention
// que types/api.ts : champs en camelCase, LocalDate en "YYYY-MM-DD", Instant
// en chaîne ISO brute. Fichier séparé de types/api.ts pour garder ce dernier
// à zéro-touche (voir le plan de la fonctionnalité).

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

export const VERDICT_FACTOR_LABELS: Record<VerdictFactor, string> = {
  FINAL_PRICE_VS_FAIR_VALUE: 'Prix final vs juste valeur',
  RETAIL_DISCOUNT: 'Décote vs neuf',
  REAL_MARKET_ALIGNMENT: 'Alignement marché réel',
  CONDITION: 'État',
  COMPLETENESS: 'Complétude',
  AVAILABILITY: 'Disponibilité',
  EDITION_QUALITY: "Qualité d'édition",
  COST_TO_COMPLETE: 'Coût pour compléter',
  NEW_EDITION_RISK: 'Risque nouvelle édition',
  RARITY: 'Rareté',
}

export type NegotiationAdvice = 'NEGOTIATE' | 'ACCEPTABLE_AS_IS' | 'SKIP_LISTING'

export type PriceBasis = 'OBSERVED_MARKET' | 'AI_ESTIMATED' | 'THEORETICAL_ONLY'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type WarningSeverity = 'INFO' | 'CAUTION' | 'CRITICAL'

export type WeightLevel = 'LOW' | 'MEDIUM' | 'HIGH'

// --- Requêtes ---

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
  askingPrice: number
  shippingFee?: number
  buyerProtectionFee?: number
  condition: Condition
  conditionAppliesToContainer: boolean
  items: ListingItemRequest[]
  photoUrls?: string[]
}

export interface CreateMangaEditionRequest {
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

// --- Réponses (miroir des records de domaine, exposés tels quels) ---

export interface MangaEditionDto {
  id: string
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
}

export interface CollectorPreferencesDto {
  preferCompletedSeries: boolean
  avoidOngoingSeries: boolean
  preferOmnibusIntegral: boolean
  editionTierRanking: EditionTier[]
  avoidOutdatedEditionWhenBetterExistsOrAnnounced: boolean
  frenchLanguageOnly: boolean
  preferEasyToCompleteCollections: boolean
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
  /** Phase 2 (assistance IA) - non null seulement quand basis === 'AI_ESTIMATED'. */
  aiEstimatedPrice: number | null
}

export interface WarningDto {
  severity: WarningSeverity
  message: string
  confidence: ConfidenceLevel
}

/** "Analyse d'un lot" (brainstorm) - doublons entre ce ListingItem et les
 * tomes déjà possédés (voir DuplicateDetector côté backend). Purement
 * consultatif : n'affecte jamais negotiation/verdict, dont le calcul reste
 * exactement celui vérifié contre les exemples du cahier des charges. */
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
  /** "Analyse d'un lot" - jusqu'à quel prix ce lot reste intéressant une fois les doublons
   * exclus - somme des DuplicateAnalysisDto.maxWorthwhilePrice de chaque série. Null tant
   * qu'au moins une série avec des tomes utiles n'a pas de prix/tome connu. */
  totalMaxWorthwhilePrice: number | null
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

/** Phase 2 (assistance IA) - brouillon d'une édition inconnue à faire
 * relire, jamais enregistré automatiquement (voir AiEditionAdvisor côté
 * backend). Absente (204) quand aucun fournisseur IA n'est configuré. */
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

/** "Suggestions d'achats" (Mon profil) - séries déjà en collection dont une
 * édition nommée est connue mais incomplète (voir
 * PurchaseAnalysisService.findNearCompleteSuggestions côté backend). */
export interface NearCompleteSuggestionDto {
  entityId: string
  seriesTitle: string
  editionName: string
  ownedCount: number
  totalVolumes: number
  missingCount: number
  missingVolumeNumbers: number[]
  estimatedCostToComplete: number | null
  costToCompleteBasis: PriceBasis | null
}
