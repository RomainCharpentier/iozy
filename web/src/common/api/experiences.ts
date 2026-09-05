import { get, post, patch, del, buildQuery } from './client'
import type { ExperienceResponse, RecordExperienceRequest } from '@/common/types/api'

export function listExperiences(entityId: string): Promise<ExperienceResponse[]> {
  return get<ExperienceResponse[]>(`/experiences${buildQuery({ entityId })}`)
}

export function recordExperience(body: RecordExperienceRequest): Promise<ExperienceResponse> {
  return post<ExperienceResponse>('/experiences', body)
}

/**
 * Corrige une expérience déjà enregistrée. Seuls la note et le commentaire
 * sont modifiables : le type, la date et le tome concerné sont immuables côté
 * domaine - s'être trompé de type ou de tome, c'est avoir enregistré une AUTRE
 * expérience, qu'on supprime.
 *
 * Les deux champs sont remplacés tels quels, `null` compris : c'est ce qui
 * permet d'effacer une note ou un commentaire.
 */
export function updateExperience(
  id: string,
  body: { rating: number | null; comment: string | null },
): Promise<ExperienceResponse> {
  return patch<ExperienceResponse>(`/experiences/${id}`, body)
}

/** Idempotent, comme les autres suppressions de petites données du projet :
 * un id déjà retiré ne renvoie pas d'erreur. */
export function deleteExperience(id: string): Promise<void> {
  return del<void>(`/experiences/${id}`)
}
