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
}

// --- Experience ---
export interface RecordExperienceRequest {
  entityId: UUID
  experienceType: string
  occurredAt: LocalDateString
  rating?: number
  comment?: string
}

export interface ExperienceResponse {
  id: UUID
  entityId: UUID
  experienceType: string
  occurredAt: LocalDateString
  rating: number | null
  comment: string | null
}

// --- Wishlist ---
export interface WishlistEntryResponse {
  id: UUID
  entityId: UUID
  addedAt: LocalDateString
}

export type LookupStatus = 'OWNED' | 'WISHLISTED' | 'UNKNOWN'

export interface LookupResponse {
  status: LookupStatus
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

export interface DiscoveryCandidateDto {
  source: string
  externalId: string
  title: string
  imageUrl: string | null
  reason: string
}

// --- Metadata ---
export interface MetadataCandidateDto {
  source: 'JIKAN' | 'BGG' | 'IGDB' | 'OPEN_LIBRARY' | 'GOOGLE_BOOKS'
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
 * quota Google Books dépassé sur toutes les clés configurées, pour afficher
 * un message adapté plutôt que de laisser croire à tort qu'il n'y a rien. */
export interface VolumesResponseDto {
  volumes: VolumeCandidateDto[]
  quotaExceeded: boolean
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
}

export interface CreateEntityTypeRequest {
  code: string
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
}

/** Le code n'est jamais modifiable après création (voir EntityTypeService côté backend). */
export interface UpdateEntityTypeRequest {
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
}

export interface BggImportResult {
  totalFound: number
  created: number
  matchedExisting: number
  failed: number
}
