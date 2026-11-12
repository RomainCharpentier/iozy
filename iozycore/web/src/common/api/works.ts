import { get, post, put } from './client'
import type {
  CollectionSummaryDto,
  CollectorStatus,
  CollectorStatusDto,
  WorkDto,
  WorkProgressDto,
} from '../types/api'

/** One work with its elements and counts - the single entity page, for every type
 *  (a custom type gets its variants, or the work itself). 404 for an unknown work. */
export function fetchWork(entityId: string): Promise<WorkDto> {
  return get<WorkDto>(`/works/${encodeURIComponent(entityId)}`)
}

/** Every work the account owns or wishes, most recently moved first (home, "to buy"). */
export function listWorks(): Promise<WorkProgressDto[]> {
  return get<WorkProgressDto[]>('/works')
}

/** The objects of the collection: one active copy = one object, and this month's additions. */
export function fetchCollectionSummary(): Promise<CollectionSummaryDto> {
  return get<CollectionSummaryDto>('/works/summary')
}

/** Idempotent. A paused or dropped work still lists its missing elements but counts none. */
export function setCollectorStatus(entityId: string, status: CollectorStatus): Promise<CollectorStatusDto> {
  return put<CollectorStatusDto>(`/works/${encodeURIComponent(entityId)}/collector-status`, { status })
}

/** "Je l'ai" on one element (a missing volume, expansion or game of the licence), through the add
 *  path. Idempotent. Returns the work as it now stands. 404 unknown element; 409 a gap that only
 *  the add field can fill. */
export function ownWorkElement(entityId: string, elementKey: string): Promise<WorkDto> {
  return post<WorkDto>(
    `/works/${encodeURIComponent(entityId)}/elements/${encodeURIComponent(elementKey)}/own`,
  )
}

/** What a work is about and where the collector stopped; texts are null when none can be given (see `note`). */
export interface WorkStoryDto {
  summary: string | null
  soFar: string | null
  upTo: number | null
  ai: boolean
  note: string | null
}

/** The summary of a work, written by a language model on the server. Slow: ask it on demand. */
export function fetchWorkStory(entityId: string): Promise<WorkStoryDto> {
  return get<WorkStoryDto>(`/works/${entityId}/story`)
}
