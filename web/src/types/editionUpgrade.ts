// Miroir des DTOs Java de com.iozycore.api.dto.EditionUpgradeWishDtos -
// "je possède déjà cette série, mais je recherche une meilleure édition
// pour la remplacer" (Perfect, Deluxe, Collector...).

export interface CreateEditionUpgradeWishRequest {
  entityId: string
  currentEditionName: string
  desiredEditionName?: string
  note?: string
}

export interface EditionUpgradeWishDto {
  id: string
  entityId: string
  currentEditionName: string
  desiredEditionName: string | null
  note: string | null
  addedAt: string
}

/** Enrichie du titre de la série - voir EditionUpgradeWishController.enrich côté backend. */
export interface EnrichedEditionUpgradeWishDto {
  id: string
  entityId: string
  entityTitle: string
  currentEditionName: string
  desiredEditionName: string | null
  note: string | null
  addedAt: string
}
