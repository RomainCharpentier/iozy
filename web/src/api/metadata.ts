import { get, post, buildQuery, ApiError } from './client'
import type { BggImportResult, MetadataCandidateDto } from '../types/api'

export function searchMetadata(entityTypeId: string, query: string): Promise<MetadataCandidateDto[]> {
  return get<MetadataCandidateDto[]>(`/metadata/search${buildQuery({ entityTypeId, query })}`)
}

/** 404 = pas de correspondance trouvée, pas une erreur (comme côté iOS) -
 * renvoie null plutôt que de laisser l'exception remonter. */
export async function lookupBarcode(entityTypeId: string, barcode: string): Promise<MetadataCandidateDto | null> {
  try {
    return await get<MetadataCandidateDto>(`/metadata/lookup-barcode${buildQuery({ entityTypeId, barcode })}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Peut être lent côté serveur (BGG) - l'appelant doit afficher un état de
 * progression bloquant pendant l'appel. */
export function importBggCollection(username: string): Promise<BggImportResult> {
  return post<BggImportResult>(`/metadata/bgg/import${buildQuery({ username })}`)
}
