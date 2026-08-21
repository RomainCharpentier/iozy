/** Miroir de ShareDtos côté backend - voir sa javadoc pour la liste de ce qui
 * est DÉLIBÉRÉMENT absent de la vue publique (identifiants, prix, valeur
 * estimée, dates d'acquisition, notes, tags, relations, analyses). */

/** État du partage côté propriétaire. `token` null = aucun lien actif. */
export interface ShareDto {
  token: string | null
  shareCollection: boolean
  shareWishlist: boolean
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
 * Ce qu'un visiteur reçoit. Une section non partagée vaut `null` et n'est
 * même pas calculée côté serveur - distinct d'un tableau vide, qui dirait
 * « partagée, mais rien dedans ». C'est ce qui permet à la page de n'afficher
 * que les onglets réellement accessibles.
 */
export interface SharedSpaceDto {
  collection: SharedUniverseDto[] | null
  wishlist: SharedWishlistItemDto[] | null
  tierLists: SharedTierListsDto | null
}
