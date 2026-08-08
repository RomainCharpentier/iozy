import { get, post, buildQuery, ApiError } from './client'
import type { BggImportResult, MetadataCandidateDto, VolumesResponseDto } from '../types/api'

export function searchMetadata(
  entityTypeId: string,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataCandidateDto[]> {
  return get<MetadataCandidateDto[]>(`/metadata/search${buildQuery({ entityTypeId, query })}`, signal)
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

/** Recherche best-effort d'un titre d'édition française (Open Library, puis
 * Google Books en repli) - à n'appeler qu'une fois par sélection de
 * suggestion (voir QuickAddPage), pas pour toute une liste de résultats.
 * `author` (mangaka) est optionnel mais améliore nettement la précision.
 * 404 = rien trouvé, pas une erreur : renvoie null, l'appelant garde alors
 * le titre anglais/romaji déjà affiché. */
export async function fetchFrenchTitle(
  entityTypeId: string,
  query: string,
  author?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const result = await get<{ frenchTitle: string }>(
      `/metadata/french-title${buildQuery({ entityTypeId, query, author })}`,
      signal,
    )
    return result.frenchTitle
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Recherche best-effort des tomes réels (avec jaquette) des éditions
 * françaises d'une série (Google Books) - pour la sélection visuelle des
 * tomes possédés (voir VolumeSelectionGrid). `volumes` vide = rien trouvé,
 * jamais une erreur : l'appelant garde alors la saisie manuelle du tome -
 * `quotaExceeded` distingue ce cas d'un quota Google Books dépassé (voir
 * VolumesResponseDto). Résultat stocké durablement côté backend - un
 * résultat une fois trouvé n'est plus jamais rappelé automatiquement,
 * `forceRefresh` (bouton "Actualiser") est le seul moyen de relancer les
 * requêtes couvertes par la recherche initiale (mots-clés d'édition les
 * plus courants). `deepSearch` (bouton "Chercher plus d'éditions") FUSIONNE
 * en plus avec des mots-clés plus rares, jamais lancés automatiquement vu
 * leur coût - incompatible avec forceRefresh, deepSearch est alors
 * prioritaire côté backend. `malId`+`originalTitle` (déjà connus du candidat
 * sélectionné) permettent d'écarter un spin-off/side-story connu (voir
 * RelatedSeriesService côté backend) - best-effort, sans effet si l'un des
 * deux manque. */
export function searchVolumes(
  entityTypeId: string,
  title: string,
  options?: {
    author?: string
    signal?: AbortSignal
    forceRefresh?: boolean
    deepSearch?: boolean
    malId?: string
    originalTitle?: string
  },
): Promise<VolumesResponseDto> {
  const { author, signal, forceRefresh, deepSearch, malId, originalTitle } = options ?? {}
  return get<VolumesResponseDto>(
    `/metadata/volumes${buildQuery({
      entityTypeId,
      title,
      author,
      forceRefresh: forceRefresh ? 'true' : undefined,
      deepSearch: deepSearch ? 'true' : undefined,
      malId,
      originalTitle,
    })}`,
    signal,
  )
}
