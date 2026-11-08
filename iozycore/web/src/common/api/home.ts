import { get } from './client'
import type { HomeWeekDto } from '../types/home'

/** The home page "ta semaine" of the account (lot 212). Every block may be empty. */
export function fetchHomeWeek(): Promise<HomeWeekDto> {
  return get<HomeWeekDto>('/home/week')
}
