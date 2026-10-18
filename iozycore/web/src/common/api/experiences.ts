import { get, post, patch, del, buildQuery } from './client'
import type { ExperienceResponse, RecordExperienceRequest } from '@/common/types/api'

export function listExperiences(entityId: string): Promise<ExperienceResponse[]> {
  return get<ExperienceResponse[]>(`/experiences${buildQuery({ entityId })}`)
}

export function recordExperience(body: RecordExperienceRequest): Promise<ExperienceResponse> {
  return post<ExperienceResponse>('/experiences', body)
}

/**
 * Corrects an experience already recorded. Only the rating and the comment
 * can be changed: the type, the date and the volume concerned are immutable in the
 * domain - having picked the wrong type or volume means having recorded ANOTHER
 * experience, which you delete.
 *
 * Both fields are replaced as they are, `null` included: this is what
 * allows clearing a rating or a comment.
 */
export function updateExperience(
  id: string,
  body: { rating: number | null; comment: string | null },
): Promise<ExperienceResponse> {
  return patch<ExperienceResponse>(`/experiences/${id}`, body)
}

/** Idempotent, like the other deletions of small data in the project:
 * an id already removed does not return an error. */
export function deleteExperience(id: string): Promise<void> {
  return del<void>(`/experiences/${id}`)
}
