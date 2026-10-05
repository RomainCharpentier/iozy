/** Mirror of ShareDtos on the backend side - see its javadoc for the list of what
 * is DELIBERATELY absent from the public view (identifiers, prices, estimated
 * value, acquisition dates, notes, tags, relations, analyses). */

/** State of the share on the owner side. `token` null = no active link. */
export interface ShareDto {
  token: string | null
  shareCollection: boolean
  shareWishlist: boolean
  includeTierLists: boolean
}

export interface SharedCollectionItemDto {
  title: string
  coverImageUrl: string | null
  /** Editions really owned (often a single one, empty if not filled in). */
  editions: string[]
  /** DISTINCT volumes owned - 0 for a work owned without a precise volume. */
  ownedVolumeCount: number
  /** null = unknown total: the progress is then not displayed, never guessed. */
  totalVolumes: number | null
}

export interface SharedUniverseDto {
  label: string
  items: SharedCollectionItemDto[]
}

export interface SharedWishlistItemDto {
  title: string
  coverImageUrl: string | null
  addedAt: string
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

/**
 * What a visitor receives. A section that is not shared is `null` and is
 * not even computed on the server side - different from an empty array, which
 * would say "shared, but nothing in it". This is what lets the page only
 * display the tabs that are really accessible.
 */
export interface SharedSpaceDto {
  collection: SharedUniverseDto[] | null
  wishlist: SharedWishlistItemDto[] | null
  tierLists: SharedTierListsDto | null
}
