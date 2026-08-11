import { get, buildQuery } from './client'
import type { CollectionValueDto, DiscoveryCandidateDto, MonthlyPointDto, StatsSummaryDto, YearlyRecapDto } from '../types/api'

export function getStats(): Promise<StatsSummaryDto> {
  return get<StatsSummaryDto>('/insights/stats')
}

/** "Calcul automatique de la valeur de la collection" (§15 V2). */
export function getCollectionValue(): Promise<CollectionValueDto> {
  return get<CollectionValueDto>('/insights/value')
}

/** "Évolution de ma collection" - du plus ancien au plus récent, comptages uniquement. */
export function getTimeline(): Promise<MonthlyPointDto[]> {
  return get<MonthlyPointDto[]>('/insights/timeline')
}

/** "Bilan annuel" - year omis = année en cours. */
export function getYearlyRecap(year?: number): Promise<YearlyRecapDto> {
  return get<YearlyRecapDto>(`/insights/yearly-recap${buildQuery({ year: year?.toString() })}`)
}

/** entityTypeCode doit être "MANGA", "BOARD_GAME" ou "VIDEO_GAME", renvoie 400 sinon. */
export function discover(entityTypeCode: 'MANGA' | 'BOARD_GAME' | 'VIDEO_GAME'): Promise<DiscoveryCandidateDto[]> {
  return get<DiscoveryCandidateDto[]>(`/insights/discover${buildQuery({ entityTypeCode })}`)
}
