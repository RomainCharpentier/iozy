import { get, buildQuery } from './client'
import type { DiscoveryCandidateDto, MonthlyPointDto, StatsSummaryDto } from '../types/api'

export function getStats(): Promise<StatsSummaryDto> {
  return get<StatsSummaryDto>('/insights/stats')
}

/** "Évolution de ma collection" - du plus ancien au plus récent, comptages uniquement. */
export function getTimeline(): Promise<MonthlyPointDto[]> {
  return get<MonthlyPointDto[]>('/insights/timeline')
}

/** entityTypeCode doit être "MANGA", "BOARD_GAME" ou "VIDEO_GAME", renvoie 400 sinon. */
export function discover(entityTypeCode: 'MANGA' | 'BOARD_GAME' | 'VIDEO_GAME'): Promise<DiscoveryCandidateDto[]> {
  return get<DiscoveryCandidateDto[]>(`/insights/discover${buildQuery({ entityTypeCode })}`)
}
