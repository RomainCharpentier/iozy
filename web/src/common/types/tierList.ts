/** Scale S to F (see com.iozycore.domain.tierlist.Rank on the backend side, IozyCore DS v1.1 on the design side). */
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export const RANKS: Rank[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F']

export interface TierListDto {
  id: string
  name: string
  /** null = CROSS-CUTTING Tier List "all categories" (scope 'all' of the V1.2 mockup) -
   * it accepts works of any universe, see TierList on the backend side. */
  entityTypeId: string | null
  activeRanks: Rank[]
  description: string | null
  createdAt: string
  itemCount: number
  rankedCount: number
}

/** A work within a board (general ranking or custom Tier List) - never a bare id, always enriched with its title/cover (see TierListEntryResponse on the backend side). */
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

/** "Mes classements" on the detail page side (see EntityDetailPage/TomesGridSection). */
export interface EntityTierSummaryDto {
  generalRank: Rank | null
  customRanks: CustomRankEntryDto[]
}

export interface CreateTierListRequest {
  name: string
  /** null = cross-cutting Tier List "all categories" (see TierListDto.entityTypeId). */
  entityTypeId: string | null
  activeRanks?: Rank[]
  description?: string
}

export interface UpdateTierListRequest {
  name?: string
  activeRanks?: Rank[]
  description?: string
}
