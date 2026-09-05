/** Échelle S à F (voir com.iozycore.domain.tierlist.Rank côté backend, IozyCore DS v1.1 côté design). */
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export const RANKS: Rank[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F']

export interface TierListDto {
  id: string
  name: string
  /** null = Tier List TRANSVERSE "toutes catégories" (scope 'all' de la maquette V1.2) -
   * elle accepte des œuvres de n'importe quel univers, voir TierList côté backend. */
  entityTypeId: string | null
  activeRanks: Rank[]
  description: string | null
  createdAt: string
  itemCount: number
  rankedCount: number
}

/** Une œuvre au sein d'un board (classement général ou Tier List personnalisée) - jamais un id nu, toujours enrichie de son titre/jaquette (voir TierListEntryResponse côté backend). */
export interface TierListEntryDto {
  entityId: string
  title: string
  coverImageUrl: string | null
  rank: Rank | null
}

export interface TierListDetailDto {
  list: TierListDto
  ranked: TierListEntryDto[]
  unranked: TierListEntryDto[]
}

export interface GeneralBoardDto {
  ranked: Partial<Record<Rank, TierListEntryDto[]>>
  unranked: TierListEntryDto[]
}

export interface CustomRankEntryDto {
  tierListId: string
  tierListName: string
  rank: Rank
}

/** "Mes classements" côté fiche (voir EntityDetailPage/TomesGridSection). */
export interface EntityTierSummaryDto {
  generalRank: Rank | null
  customRanks: CustomRankEntryDto[]
}

export interface CreateTierListRequest {
  name: string
  /** null = Tier List transverse "toutes catégories" (voir TierListDto.entityTypeId). */
  entityTypeId: string | null
  activeRanks?: Rank[]
  description?: string
}

export interface UpdateTierListRequest {
  name?: string
  activeRanks?: Rank[]
  description?: string
}
