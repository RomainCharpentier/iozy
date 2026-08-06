import { get, post, buildQuery } from './client'
import type { ExperienceResponse, RecordExperienceRequest } from '../types/api'

export function listExperiences(entityId: string): Promise<ExperienceResponse[]> {
  return get<ExperienceResponse[]>(`/experiences${buildQuery({ entityId })}`)
}

export function recordExperience(body: RecordExperienceRequest): Promise<ExperienceResponse> {
  return post<ExperienceResponse>('/experiences', body)
}
