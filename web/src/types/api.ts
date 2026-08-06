// Miroir 1:1 des DTOs Java du backend (mêmes noms de champs en camelCase -
// voir backend/src/main/java/com/iozycore/api/dto/*.java et les records de
// domaine exposés directement, comme Tag/Relationship). Les champs LocalDate
// (acquiredAt, occurredAt, addedAt) voyagent en "YYYY-MM-DD", pas en
// ISO8601 complet - à traiter comme de simples chaînes, pas des Date.

export type UUID = string
export type LocalDateString = string // "YYYY-MM-DD"

// --- Entity ---
export interface QuickAddRequest {
  entityTypeId: UUID
  title: string
  condition: string
  attributes?: Record<string, unknown>
}

export interface QuickAddResponse {
  entityId: UUID
  matchedExistingEntity: boolean
}

export interface EntityResponse {
  id: UUID
  entityTypeId: UUID
  title: string
  attributes: Record<string, unknown>
  tagIds: UUID[]
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
  source: 'JIKAN' | 'BGG'
  externalId: string
  title: string
  imageUrl: string | null
  attributes: Record<string, unknown>
}

export interface BggImportResult {
  totalFound: number
  created: number
  matchedExisting: number
  failed: number
}
