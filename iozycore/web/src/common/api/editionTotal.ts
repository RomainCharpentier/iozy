import { put } from './client'
import type { EditionTotalDto } from '../types/api'

/**
 * The volume count of an edition, typed by a person (lot 207): stored as MANUAL,
 * never touched by the background job. `null` clears it, and the job tries again.
 * `editionName` may be left out when the series has a single named edition.
 */
export function setEditionTotal(
  entityId: string,
  editionName: string | null,
  totalVolumes: number | null,
): Promise<EditionTotalDto> {
  return put<EditionTotalDto>(`/manga/series/${encodeURIComponent(entityId)}/total`, {
    editionName,
    totalVolumes,
  })
}
