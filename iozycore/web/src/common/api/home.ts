import { get, post } from './client'
import type { HomeWeekDto } from '../types/home'

/** The home page "ta semaine" of the account (lot 212). Every block may be empty. */
export function fetchHomeWeek(): Promise<HomeWeekDto> {
  return get<HomeWeekDto>('/home/week')
}

/** What Izy answers: the text, whether a language model wrote it, and why not when it did not. */
export interface GuideAnswerDto {
  text: string
  ai: boolean
  note: string | null
}

/** Asks Izy about the collection. Without a question, Izy says what deserves attention. */
export function askGuide(question: string | null): Promise<GuideAnswerDto> {
  return post<GuideAnswerDto>('/home/guide', { question })
}

/** One work Izy recommends: confirmed by a catalog source, with the reason the model gave. */
export interface RecommendationDto {
  title: string
  entityTypeId: string
  imageUrl: string | null
  why: string
}

export interface RecommendationsDto {
  items: RecommendationDto[]
  ai: boolean
  note: string | null
}

/** Works the account does not own and may like. Slow (a model, then the catalog sources): call it sparingly. */
export function fetchRecommendations(): Promise<RecommendationsDto> {
  return get<RecommendationsDto>('/home/recommendations')
}
