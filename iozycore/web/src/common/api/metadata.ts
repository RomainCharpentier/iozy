import { get, post, buildQuery, ApiError } from './client'
import type { BggImportResult, MetadataCandidateDto, VolumesResponseDto } from '@/common/types/api'

/** A queried series, and as it comes back if it is known to have no volume. */
export interface SerieInterrogee {
  title: string
  author?: string
}

/**
 * Among these series, which ones are already known to have no volume at all?
 *
 * Answers from the durable cache only, without calling any provider: really
 * asking the question would cost eight Google Books requests PER SERIES. A
 * series never searched is therefore not flagged - "we do not know" is
 * not "we know there are none".
 */
export function seriesSansTomesConnues(
  entityTypeId: string,
  series: SerieInterrogee[],
): Promise<SerieInterrogee[]> {
  return post<SerieInterrogee[]>('/metadata/volumes/known-empty', { entityTypeId, series })
}

/**
 * The candidates to ADD: what we already own is removed on the server side,
 * so as not to offer adding the same work twice.
 */
export function searchMetadata(
  entityTypeId: string,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataCandidateDto[]> {
  return get<MetadataCandidateDto[]>(`/metadata/search${buildQuery({ entityTypeId, query })}`, signal)
}

/**
 * The same endpoint, without this filter: "what does the source know about THIS work,
 * the one I already have?" - the question of reloading a detail page.
 *
 * Two named functions rather than a boolean at the end of a call: the filter
 * decides what the answer can contain, it is not a tuning
 * detail. On a detail page, `searchMetadata` returned by construction zero
 * matches - checked on Naruto, which returned eight spin-offs and never the
 * series.
 */
export function rechercherOeuvrePossedee(
  entityTypeId: string,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataCandidateDto[]> {
  return get<MetadataCandidateDto[]>(
    `/metadata/search${buildQuery({ entityTypeId, query, includeOwned: 'true' })}`,
    signal,
  )
}

/**
 * What only a second call to the source knows about ONE work: a board game's
 * cover, players and designers, which BGG does not give at search time
 * (batch 160). The work is named by its source ids (`{ bggId: '822' }`).
 *
 * `{}` when the source has nothing more or did not answer: the caller keeps
 * what the search gave, nothing fails.
 */
export function detailsOeuvre(
  entityTypeId: string,
  identifiants: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(`/metadata/details${buildQuery({ ...identifiants, entityTypeId })}`, signal)
}

/** 404 = the databases answered and do not know this code: this is not an
 * error (as on the iOS side), hence `null` rather than an exception. A 503 - a database
 * did not answer - comes up on the contrary, because the screen must say it
 * differently: retrying makes sense, searching by title does not. */
export async function lookupBarcode(entityTypeId: string, barcode: string): Promise<MetadataCandidateDto | null> {
  try {
    return await get<MetadataCandidateDto>(`/metadata/lookup-barcode${buildQuery({ entityTypeId, barcode })}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Can be slow on the server side (BGG) - the caller must display a blocking
 * progress state during the call. */
export function importBggCollection(username: string): Promise<BggImportResult> {
  return post<BggImportResult>(`/metadata/bgg/import${buildQuery({ username })}`)
}

/** Best-effort search of a French edition title (Open Library, then
 * Google Books as a fallback) - to call only once per selection of a
 * suggestion (see QuickAddPage), not for a whole list of results.
 * `author` (mangaka) is optional but clearly improves precision.
 * `malId` (already known from the selected candidate) lets us rule out a known
 * sequel/spin-off (see RelatedSeriesService on the backend side) wrongly resolved
 * instead of the searched title - e.g. "Dragon Ball Super nº 18" for "Dragon
 * Ball" (checked manually, see history) - best-effort, no effect
 * if absent. `titleRomaji` is tried as a fallback for `query` for this same
 * detection (checked manually on "Attack on Titan"/"Shingeki no
 * Kyojin", see history) - a spin-off can be indexed on the
 * MyAnimeList side under the romaji title rather than the displayed title. Nothing
 * found is not an error: the server answers 204 (a 404 before batch 193, still
 * accepted from an older server) and this returns null, the caller then keeps
 * the English/romaji title already displayed. */
export async function fetchFrenchTitle(
  entityTypeId: string,
  query: string,
  options?: { author?: string; malId?: string; titleRomaji?: string; signal?: AbortSignal },
): Promise<string | null> {
  const { author, malId, titleRomaji, signal } = options ?? {}
  try {
    const result = await get<{ frenchTitle: string } | undefined>(
      `/metadata/french-title${buildQuery({ entityTypeId, query, author, malId, titleRomaji })}`,
      signal,
    )
    return result?.frenchTitle ?? null
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Best-effort search of the real volumes (with cover) of the French
 * editions of a series (Google Books) - for the visual selection of the
 * owned volumes (see VolumeSelectionGrid). Empty `volumes` = nothing found,
 * never an error: the caller then keeps the manual entry of the volume -
 * `quotaExceeded` tells this case apart from a transient failure of the provider -
 * quota exceeded, or a source that did not answer (see VolumesResponseDto). Result stored durably on the backend side - a
 * result once found is never called again automatically,
 * `forceRefresh` ("Actualiser" button) is the only way to run again the
 * requests covered by the initial search (the most common
 * edition keywords). `deepSearch` ("Chercher plus d'éditions" button) also MERGES
 * with rarer keywords, never run automatically given
 * their cost - incompatible with forceRefresh, deepSearch then takes
 * priority on the backend side. `malId`+`originalTitle` (already known from the selected
 * candidate) let us rule out a known spin-off/side-story (see
 * RelatedSeriesService on the backend side) - best-effort, no effect if one of the
 * two is missing. `titleRomaji` is tried as a fallback for `originalTitle` for
 * this same detection (see fetchFrenchTitle above). */
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
    titleRomaji?: string
    totalVolumes?: number
  },
): Promise<VolumesResponseDto> {
  const { author, signal, forceRefresh, deepSearch, malId, originalTitle, titleRomaji, totalVolumes } = options ?? {}
  return get<VolumesResponseDto>(
    `/metadata/volumes${buildQuery({
      entityTypeId,
      title,
      author,
      forceRefresh: forceRefresh ? 'true' : undefined,
      deepSearch: deepSearch ? 'true' : undefined,
      malId,
      originalTitle,
      titleRomaji,
      totalVolumes: totalVolumes?.toString(),
    })}`,
    signal,
  )
}
