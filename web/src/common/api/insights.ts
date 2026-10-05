import { get, buildQuery } from './client'
import type { CollectionProgressDto, CollectionValueDto, DiscoveryCandidateDto, MonthlyPointDto, ReleaseCalendarDto, StatsSummaryDto, YearlyRecapDto } from '@/common/types/api'

export function getStats(): Promise<StatsSummaryDto> {
  return get<StatsSummaryDto>('/insights/stats')
}

/** "Automatic calculation of the collection value" (§15 V2). */
export function getCollectionValue(): Promise<CollectionValueDto> {
  return get<CollectionValueDto>('/insights/value')
}

/** "Evolution of my collection" - from oldest to newest, counts only. */
export function getTimeline(): Promise<MonthlyPointDto[]> {
  return get<MonthlyPointDto[]>('/insights/timeline')
}

/** "Yearly recap" - year omitted = current year. */
export function getYearlyRecap(year?: number): Promise<YearlyRecapDto> {
  return get<YearlyRecapDto>(`/insights/yearly-recap${buildQuery({ year: year?.toString() })}`)
}

/** The progress of ALL works, in one call - to be used rather than
 *  recomputed (see CollectionProgressService on the server side). */
export function getCollectionProgress(): Promise<CollectionProgressDto[]> {
  return get<CollectionProgressDto[]>('/insights/progress')
}

/** The same progress, for ONE work: what its detail page needs, without
 *  downloading the one of the whole collection. */
export function getEntityProgress(entityId: string): Promise<CollectionProgressDto> {
  return get<CollectionProgressDto>(`/insights/progress/${entityId}`)
}

/** entityTypeCode must be "MANGA", "BOARD_GAME" or "VIDEO_GAME", returns 400 otherwise. */
/** The discoveries of a universe - to call only for a type whose `hasDiscoverySource` is true (400 otherwise). */
export function discover(entityTypeCode: string): Promise<DiscoveryCandidateDto[]> {
  return get<DiscoveryCandidateDto[]>(`/insights/discover${buildQuery({ entityTypeCode })}`)
}

/** The releases between two days inclusive (one year at most), all categories together (batch 146). */
export function getReleaseCalendar(from: string, to: string): Promise<ReleaseCalendarDto> {
  return get<ReleaseCalendarDto>(`/insights/releases${buildQuery({ from, to })}`)
}
