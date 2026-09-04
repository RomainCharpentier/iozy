// Miroir 1:1 des DTOs Java du backend (mêmes noms de champs en camelCase -
// voir backend/src/main/java/com/iozycore/api/dto/*.java et les records de
// domaine exposés directement, comme Tag/Relationship). Les champs LocalDate
// (acquiredAt, occurredAt, addedAt) voyagent en "YYYY-MM-DD", pas en
// ISO8601 complet - à traiter comme de simples chaînes, pas des Date.

export type UUID = string
export type LocalDateString = string // "YYYY-MM-DD"

// --- Entity ---
// volumeNumber/edition sont réservés au cas "tome d'une série" (Manga) : voir
// QuickAddService côté backend pour la distinction série (Entity) / tome
// précis d'une édition (Variant).
export interface QuickAddRequest {
  entityTypeId: UUID
  title: string
  condition: string
  attributes?: Record<string, unknown>
  volumeNumber?: number
  edition?: string
  // Jaquette de CE tome précis (voir VolumeCandidateDto), distincte de la
  // jaquette de la série éventuellement présente dans `attributes`.
  volumeImageUrl?: string
  // Optionnel, jamais deviné - reste modifiable après coup (voir ownerships.ts updatePurchasePrice).
  purchasePrice?: number
  /** Un seul usage : annuler un retrait de tome en rendant sa date d'origine
   *  plutôt qu'en la remplaçant par aujourd'hui (voir EntityDetailPage).
   *  Absente = aujourd'hui, comme n'importe quel ajout. */
  acquiredAt?: string
}

export interface QuickAddResponse {
  entityId: UUID
  matchedExistingEntity: boolean
  variantId: UUID | null
  // Une Ownership active référence déjà ce même Variant (ce tome précis) -
  // ne bloque jamais l'ajout (un 2e exemplaire du même tome est légitime),
  // sert seulement à avertir l'utilisateur.
  matchedExistingVariant: boolean
}

export interface VariantDto {
  id: UUID
  label: string
  attributes: Record<string, unknown>
  /** Édition catalogue liée à ce tome, quand elle est connue (modèle Série -> Édition -> Tome). */
  mangaEditionId: UUID | null
}

export interface EntityResponse {
  id: UUID
  entityTypeId: UUID
  title: string
  attributes: Record<string, unknown>
  tagIds: UUID[]
  variants: VariantDto[]
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
  // Facultatif : quel tome précis cette expérience concerne (voir Experience
  // côté backend) - absent = la série entière, ou un type sans notion de tome.
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
  /** Le TOME voulu. Absent quand l'envie porte sur l'œuvre entière - le cas
   *  des types sans notion de tome, où l'œuvre EST l'objet collectionnable
   *  (voir com.iozycore.domain.wishlist.WishlistEntry). */
  variantId?: UUID | null
  id: UUID
  entityId: UUID
  addedAt: LocalDateString
}

// --- Tag / Relationship (records de domaine exposés tels quels) ---
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

/** "Évolution de ma collection" - un mois, voir StatsService.computeTimeline côté backend.
 * month au format "YYYY-MM". Comptages uniquement, aucune valeur monétaire. */
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

/** "Calcul automatique de la valeur de la collection" (§15 V2) - voir
 * StatsService.computeCollectionValue côté backend. totalKnownValue n'est
 * JAMAIS la valeur réelle complète : pricedOwnershipCount/totalActiveOwnershipCount
 * indique toujours combien de possessions ont un prix renseigné. */
export interface CollectionValueDto {
  totalKnownValue: number
  pricedOwnershipCount: number
  totalActiveOwnershipCount: number
  byType: TypeValueDto[]
}

/** "Bilan annuel" - voir StatsService.computeYearlyRecap côté backend. Pas d'endpoint
 * public/non-authentifié : le partage se fait en téléchargeant l'image générée côté client. */
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

// --- Metadata ---
export interface MetadataCandidateDto {
  source: 'JIKAN' | 'MYANIMELIST' | 'BGG' | 'IGDB' | 'OPEN_LIBRARY' | 'GOOGLE_BOOKS'
  externalId: string
  title: string
  imageUrl: string | null
  attributes: Record<string, unknown>
}

/** Un tome précis d'une édition réelle d'une série (voir VolumeCandidate
 * côté backend) - pour la sélection visuelle des tomes possédés. */
export interface VolumeCandidateDto {
  edition: string
  volumeNumber: number
  imageUrl: string | null
  title: string
  // Une Ownership active référence déjà le Variant correspondant (série déjà
  // présente dans la collection) - purement indicatif, ne bloque jamais la
  // sélection (un 2e exemplaire du même tome reste possible).
  alreadyOwned: boolean
}

/** Réponse de GET /metadata/volumes (voir VolumesResponse côté backend) -
 * `quotaExceeded` distingue une liste vide "aucune édition trouvée" d'un
 * échec TRANSITOIRE du fournisseur : quota dépassé sur toutes les clés, ou
 * source qui n'a pas répondu du tout (503, délai dépassé). Dans les deux cas
 * l'écran doit dire "réessaie" plutôt que de laisser croire qu'il n'y a rien.
 * Le nom du champ ne parle que du quota par compatibilité (il est décodé tel
 * quel par le client iOS) - côté serveur il se nomme `providerUnavailable`. */
export interface VolumesResponseDto {
  volumes: VolumeCandidateDto[]
  quotaExceeded: boolean
}

/**
 * « Combien de tomes possédés sur combien », calculé PAR LE SERVEUR.
 *
 * Miroir de com.iozycore.insights.CollectionProgress. La règle - notamment le
 * rattachement des tomes sans édition précisée à l'unique édition nommée d'une
 * série - vit là-bas et nulle part ailleurs : la recalculer ici a déjà produit
 * deux divergences (voir docs/DESIGN_MIGRATION_V1.2.md, lots 31 et 49).
 */
export interface EditionProgressDto {
  /** `''` = les tomes sans édition précisée, quand ils forment un groupe à part. */
  editionName: string
  sourceEditions: string[]
  ownedVolumeNumbers: number[]
  cataloguedVolumeNumbers: number[]
  /** null tant que le total de l'édition n'est pas renseigné - jamais deviné. */
  totalVolumes: number | null
}

export interface CollectionProgressDto {
  entityId: UUID
  title: string
  editions: EditionProgressDto[]
  /** L'édition qui représente cette œuvre - null quand elle n'a aucun tome. */
  dominantEdition: EditionProgressDto | null
  ownedVolumeCount: number
}

// --- EntityType (éditeur de types dynamique) ---
export interface EntityTypeDto {
  id: UUID
  code: string
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
  // Au moins un fournisseur de métadonnées (Jikan/BGG/IGDB) supporte ce
  // type - jamais le cas pour un type personnalisé créé via cet éditeur.
  hasMetadataProvider: boolean
  /** Identité visuelle choisie (voir lib/entityTypeVisuals) - null = visuel
   * par défaut. Des CLÉS, jamais des couleurs : seul le client sait les
   * traduire, et lui seul sait s'adapter au thème clair/sombre. */
  colorKey: string | null
  iconKey: string | null
  /** Format de jaquette (voir UNIVERSE_ASPECTS) - null = format par défaut du type. */
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

/** Le code n'est jamais modifiable après création (voir EntityTypeService côté backend). */
export interface UpdateEntityTypeRequest {
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
  /** Absent = retour au visuel par défaut : l'appelant envoie l'état voulu en
   * entier, jamais un delta (voir EntityTypeController.update). */
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

/** Ce qu'un import ferait (analyse) ou vient de faire (appliqué) - voir ImportReport côté backend. */
export interface ImportReport {
  applique: boolean
  sections: ImportSection[]
  remarques: ImportRemarque[]
  /** Au-delà d'un plafond, les remarques ne sont plus listées, seulement comptées. */
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

/** La réponse d'une IA à une question sur la collection - voir CollectionAnswer côté backend. */
export interface CollectionAnswerDto {
  reponse: string
  /** Les fiches sur lesquelles la réponse s'appuie, vérifiées côté serveur : jamais un id inventé. */
  oeuvres: { id: UUID; titre: string }[]
  confiance: 'HIGH' | 'MEDIUM' | 'LOW'
  modele: string
}
