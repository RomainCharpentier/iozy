/** Mirror of ShareDtos on the backend side - see its javadoc for the list of what
 * is DELIBERATELY absent from the public view (identifiers, prices, estimated
 * value, acquisition dates, notes, tags, relations, analyses). */

/** State of the share on the owner side. `token` null = no active link. */
export interface ShareDto {
  token: string | null
  shareCollection: boolean
  shareWishlist: boolean
  includeTierLists: boolean
  /** The value of the collection on the public page (lot 217). Even on, the server only
   *  shows it when it rests on enough prices. Absent from older answers. */
  showValue?: boolean
  /** "Mes 4 incontournables", in order (lot 217). */
  pinnedWorkIds?: string[]
  /** The gift list link (lot 217), null when there is none. */
  giftLink?: GiftLinkDto | null
}

/** The gift list link: the wishes only, valid 30 days from its creation or last renewal. */
export interface GiftLinkDto {
  token: string
  /** ISO instant. */
  expiresAt: string
  expired: boolean
}

/** A pinned work, shown first and big on the public page (lot 217). */
export interface SharedPinnedWorkDto {
  title: string
  coverImageUrl: string | null
  ownedCount: number
  /** null = unknown total, never guessed. */
  totalCount: number | null
}

/** The value of the collection, only when enough prices back it (5 at least, half of the objects). */
export interface SharedValueDto {
  totalKnownValue: number
  pricedCount: number
  totalCount: number
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
  /** Lot 217. null when the collection is not shared. */
  pinned?: SharedPinnedWorkDto[] | null
  /** Lot 217. null when not shown, or resting on too few prices. */
  value?: SharedValueDto | null
  /** Lot 217: a gift list link, the wishes only. */
  giftList?: boolean
  /** Lot 217: until when a gift list answers (ISO instant); null for the share link. */
  expiresAt?: string | null
}
