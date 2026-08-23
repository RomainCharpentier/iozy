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
  /** Texte de l'annonce - alimente les points de vigilance. Absent, ils se taisent. */
  description?: string
  askingPrice: number
  shippingFee?: number
  /** Sans elle, le serveur suppose UNKNOWN - jamais un tarif ferme. */
  shippingKind?: ShippingEstimateKind
  buyerProtectionFee?: number
  condition: Condition
  conditionAppliesToContainer: boolean
  items: ListingItemRequest[]
  photoUrls?: string[]
  /** Identifiant rendu par la lecture du lien. Ne change rien au calcul : il permet
   * de reconnaître deux analyses de la même annonce, pour qu'une offre ne se compare
   * pas à elle-même et ne compte pas pour plusieurs vendeurs. */
  externalListingId?: string
}

export interface CreateMangaEditionRequest {
  /** Voir migration "Série -> Édition par ID" - à fournir dès que l'appelant connaît
   * la Série avec certitude (ex: fiche Série), lié directement plutôt que retrouvé
   * par correspondance de titre. */
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

// --- Réponses (miroir des records de domaine, exposés tels quels) ---

export interface MangaEditionDto {
  id: string
  /** Lien vers la Série catalogue (Entity) quand elle est connue - nullable, jamais deviné (modèle Série -> Édition -> Tome). */
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
 * D'où vient un prix relevé. Ni une hiérarchie de fiabilité ni un niveau de
 * confiance - les deux origines valent autant, ce sont des prix vus. Sert à
 * savoir ce qu'on regarde quand un chiffre surprend.
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
  /** Tomes réellement concernés - fait autorité sur `scope`, un lot pouvant être discontinu. */
  volumeCount: number | null
  /** Identité de l'annonce d'origine ; null pour une saisie manuelle. Plusieurs relevés
   * de même identité suivent UNE offre dans le temps, pas plusieurs vendeurs. */
  listingIdentity: string | null
  sourceUrl: string | null
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
  /** Parmi missingVolumeNumbers, les tomes déjà catalogués (un Variant existe, juste sans
   * Ownership) plutôt que purement virtuels (aucun Variant, modèle Tome != Ownership) - vide
   * si l'appelant n'a pas fourni cataloguedVolumes à GET /purchase-analysis/completeness. */
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
  /** Les trois dimensions de l\'annonce - voir ListingAssessmentDto. */
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
  /** Parmi missingVolumeNumbers, les tomes déjà catalogués (un Variant existe, juste sans
   * Ownership) plutôt que purement virtuels (aucun Variant, modèle Tome != Ownership). */
  cataloguedMissingVolumeNumbers: number[]
  estimatedCostToComplete: number | null
  costToCompleteBasis: PriceBasis | null
}

// --- Lecture d'une annonce depuis son lien (voir ListingMetadataController) ---

/**
 * Issue d'une tentative de lecture d'annonce. Volontairement plus riche qu'un
 * booléen : l'utilisateur n'a pas la même chose à faire selon les cas, et un
 * message unique serait inutile dans les cinq.
 *
 * - `SUCCESS` / `PARTIAL` : des données ont été lues (partiellement pour le
 *   second). Dans les deux cas on pré-remplit ce qui a été trouvé.
 * - `UNSUPPORTED_SOURCE` : plateforme pas encore prise en charge. L'URL est
 *   conservée, la saisie manuelle continue.
 * - `LISTING_NOT_FOUND` : l'annonce n'existe plus.
 * - `UNAVAILABLE` : la source n'a rien livré d'exploitable.
 * - `INVALID_URL` : lien inexploitable (le formulaire l'attrape en local avant
 *   même d'appeler le serveur).
 */
export type ListingResolutionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_SOURCE'
  | 'LISTING_NOT_FOUND'
  | 'UNAVAILABLE'

/** Les champs qu'une source peut rendre - `retrievedFields` dit lesquels ont RÉELLEMENT été lus. */
/**
 * Ce que vaut le montant de livraison retenu pour l'annonce.
 *
 * `FROM` = « à partir de » : plusieurs modes existent et la source affiche le
 * moins cher. Le total qui en découle est alors un MINIMUM, pas un coût
 * facturé - et l'écran doit le dire.
 *
 * `ESTIMATED` = un montant utilisable mais non garanti, typiquement saisi par
 * l'utilisateur. Il compte dans le coût, et l'écran ne doit surtout pas parler
 * de livraison « non communiquée » : elle vient d'être communiquée.
 *
 * `UNKNOWN` = aucun montant. Le total est alors INCOMPLET : c'est un sous-total,
 * pas un coût d'acquisition.
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
  /** Frais de port annoncés - prix « à partir de » quand plusieurs modes de
   * livraison existent, et 0 quand elle est offerte. null = illisible. */
  shippingFee: number | null
  /** Ce que ce montant vaut : offert, ferme, simple plancher, ou illisible. */
  shippingKind: ShippingEstimateKind
  /** Protection acheteur réellement facturée (après remise éventuelle). */
  buyerProtectionFee: number | null
  imageUrls: string[]
  retrievedAt: string | null
  /** Ce qui a été trouvé. Un champ absent d'ici n'est jamais deviné. */
  retrievedFields: ListingField[]
}

// --- Évaluation d'une annonce : trois dimensions, puis une synthèse ---

/** Ce que le lot apporte à CETTE collection. */
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
  /** null quand le coût n'est pas calculable. */
  pricePerItem: number | null
  /** null quand rien n'est utile - on n'affiche alors pas « 0 € le tome utile ». */
  pricePerUsefulItem: number | null
  interest: CollectionInterest
}

/** Où se situe le prix. `REFERENCE_UNAVAILABLE` = on ne juge pas, faute de référence fiable. */
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

/** Paliers nommés, jamais une note sur 100 : IozyCore ne mesure pas une probabilité de fraude. */
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
 * Les trois dimensions gardées distinctes, plus la synthèse.
 *
 * Elles ne se compensent pas : un lot bradé mais entièrement en doublon reste
 * un mauvais achat à bon prix, et l'écran doit pouvoir le dire.
 */
/**
 * Ce que vaut la référence marché, l'absence comprise. Seuls HIGH et MEDIUM
 * autorisent un positionnement prix : LOW dit « on a quelque chose, mais pas de
 * quoi trancher », UNAVAILABLE qu'il n'y a rien.
 */
export type MarketReferenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE'

/**
 * D'où vient la référence. Une seule source en produit une : les prix relevés
 * dans IozyCore. Ni l'estimation IA ni le prix neuf catalogue ne deviennent
 * « le marché » - ils restent utiles ailleurs (coût pour compléter, négociation,
 * verdict global). `NOT_RECORDED` : analyse antérieure à cet enregistrement.
 */
export type MarketReferenceSource = 'OBSERVED_COMPARABLES' | 'NONE' | 'NOT_RECORDED'

/** Ce qui manque pour qu'une référence existe - sert à dire quoi faire, pas seulement qu'on ne sait pas. */
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
  /** null dès que la référence n'est pas exploitable - un chiffre affiché est un chiffre auquel on croit. */
  referencePrice: number | null
  referenceConfidence: MarketReferenceConfidence
  /** Écart signé à la référence, en pourcentage. */
  deviationPercent: number | null
  /** Annonces comparables retenues derrière `referencePrice` ; 0 quand il n'y en a pas. */
  referenceSampleSize: number
  referenceSource: MarketReferenceSource
  referenceGap: ReferenceGap
  trust: ListingTrustAssessmentDto
  headline: AssessmentHeadline
}
