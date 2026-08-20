/** Miroir de CollectionShareDtos côté backend - voir sa javadoc pour la liste
 * de ce qui est DÉLIBÉRÉMENT absent de la vue publique (identifiants, prix,
 * valeur estimée, dates, wishlist). */

/** `token` null = aucun lien actif. */
export interface CollectionShareDto {
  token: string | null
  includeTierLists: boolean
}

export interface SharedCollectionItemDto {
  title: string
  coverImageUrl: string | null
  /** Éditions réellement possédées (souvent une seule, vide si non renseignée). */
  editions: string[]
  /** Tomes DISTINCTS possédés - 0 pour une œuvre possédée sans tome précis. */
  ownedVolumeCount: number
  /** null = total inconnu : la progression n'est alors pas affichée, jamais devinée. */
  totalVolumes: number | null
}

export interface SharedUniverseDto {
  label: string
  items: SharedCollectionItemDto[]
}

export interface SharedRankedItemDto {
  title: string
  coverImageUrl: string | null
}

export interface SharedTierRowDto {
  rank: string
  items: SharedRankedItemDto[]
}

export interface SharedTierBoardDto {
  label: string
  rows: SharedTierRowDto[]
}

export interface SharedTierListsDto {
  general: SharedTierBoardDto[]
  custom: SharedTierBoardDto[]
}

export interface SharedCollectionDto {
  universes: SharedUniverseDto[]
  /** null = le propriétaire ne partage PAS ses classements - distinct d'une
   * liste vide, qui voudrait dire "partagés, mais aucun". */
  tierLists: SharedTierListsDto | null
}
