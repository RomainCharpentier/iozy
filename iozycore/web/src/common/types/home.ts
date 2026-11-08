import type { CollectorStatus, UUID, WorkElementState } from './api'

// --- The home page "ta semaine" (lot 212): GET /api/home/week ---
// Every block may be empty (null or []). The server says WHY a work is there;
// the sentences are written on the client, in French (see pages/home/phrases).

/** A work as a home block shows it. */
export interface HomeWorkDto {
  entityId: UUID
  entityTypeId: UUID
  title: string
  coverImageUrl: string | null
  collectorStatus: CollectorStatus
  ownedCount: number
  /** Null when nobody knows the total: never guessed. */
  totalCount: number | null
  missingCount: number
  wishedCount: number
  /** ISO instant of the latest copy or wish of the account. */
  lastMovedAt: string | null
}

export interface HomeReleaseDto {
  /** "2026-11-13" or "2026-11". */
  date: string
  precision: 'DAY' | 'MONTH'
  /** "Tome 15", empty when it is the work itself. */
  label: string
  number: number | null
}

export interface HomeElementDto {
  key: string
  label: string
  number: number | null
  state: WorkElementState
  countedAsMissing: boolean
  variantId: UUID | null
}

/** RELEASE: it comes out this week. MOVED: a copy or a wish of the account (this week, or last for the lead). */
export type HomeReason = 'RELEASE' | 'MOVED'

export interface HomeLeadDto {
  work: HomeWorkDto
  reason: HomeReason
  /** The release this week; null for MOVED. */
  release: HomeReleaseDto | null
  nextRelease: HomeReleaseDto | null
  /** Every element of the work, in order: the gauge. */
  elements: HomeElementDto[]
}

export interface HomeItemDto {
  work: HomeWorkDto
  reason: HomeReason
  release: HomeReleaseDto | null
}

export interface HomeFigureDto {
  /** Active copies: the big number. */
  totalObjects: number
  addedThisMonth: number
  releasesThisWeek: number
}

export interface HomeAlmostDoneDto {
  work: HomeWorkDto
  /** The elements counted as missing (1 to 3). */
  missing: HomeElementDto[]
}

export interface HomeShelfDto {
  entityTypeId: UUID
  workCount: number
  objectCount: number
  covers: { entityId: UUID; title: string; coverImageUrl: string }[]
}

export interface HomeWeekDto {
  /** The Monday of the week, "2026-11-02"; weekEnd is its Sunday. */
  weekStart: string
  weekEnd: string
  une: HomeLeadDto | null
  aussi: HomeItemDto[]
  chiffre: HomeFigureDto | null
  presqueFini: HomeAlmostDoneDto[]
  rayons: HomeShelfDto[]
}
