import { get, buildQuery } from './client'
import type { DiscoveryCandidateDto, StatsSummaryDto } from '../types/api'

export function getStats(): Promise<StatsSummaryDto> {
  return get<StatsSummaryDto>('/insights/stats')
}

/** entityTypeCode doit être "MANGA", "BOARD_GAME" ou "VIDEO_GAME", renvoie 400 sinon. */
export function discover(entityTypeCode: 'MANGA' | 'BOARD_GAME' | 'VIDEO_GAME'): Promise<DiscoveryCandidateDto[]> {
  return get<DiscoveryCandidateDto[]>(`/insights/discover${buildQuery({ entityTypeCode })}`)
}
