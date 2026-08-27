import { get, post, buildQuery, ApiError } from './client'
import type { BggImportResult, MetadataCandidateDto, VolumesResponseDto } from '../types/api'

/** Une série interrogée, et telle qu'elle revient si on la sait sans tome. */
export interface SerieInterrogee {
  title: string
  author?: string
}

/**
 * Parmi ces séries, lesquelles sait-on déjà sans aucun tome ?
 *
 * Répond depuis le seul cache durable, sans appeler de fournisseur : poser
 * vraiment la question coûterait huit requêtes Google Books PAR SÉRIE. Une
 * série jamais recherchée n'est donc pas signalée - « on ne sait pas » n'est
 * pas « on sait qu'il n'y en a pas ».
 */
export function seriesSansTomesConnues(
  entityTypeId: string,
  series: SerieInterrogee[],
): Promise<SerieInterrogee[]> {
  return post<SerieInterrogee[]>('/metadata/volumes/known-empty', { entityTypeId, series })
}

export function searchMetadata(
  entityTypeId: string,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataCandidateDto[]> {
  return get<MetadataCandidateDto[]>(`/metadata/search${buildQuery({ entityTypeId, query })}`, signal)
}

/** 404 = les bases ont répondu et ne connaissent pas ce code : ce n'est pas une
 * erreur (comme côté iOS), d'où `null` plutôt qu'une exception. Un 503 - une base
 * n'a pas répondu - remonte au contraire, parce que l'écran doit le dire
 * autrement : ré-essayer a du sens, chercher par titre non. */
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
 * `malId` (déjà connu du candidat sélectionné) permet d'écarter une suite/
 * spin-off connu(e) (voir RelatedSeriesService côté backend) mal résolu(e)
 * à la place du titre cherché - ex: "Dragon Ball Super nº 18" pour "Dragon
 * Ball" (vérifié manuellement, voir historique) - best-effort, sans effet
 * si absent. `titleRomaji` est essayé en repli de `query` pour cette même
 * détection (vérifié manuellement sur "Attack on Titan"/"Shingeki no
 * Kyojin", voir historique) - un spin-off peut être indexé côté
 * MyAnimeList sous le titre romaji plutôt que le titre affiché. 404 = rien
 * trouvé, pas une erreur : renvoie null, l'appelant garde alors le titre
 * anglais/romaji déjà affiché. */
export async function fetchFrenchTitle(
  entityTypeId: string,
  query: string,
  options?: { author?: string; malId?: string; titleRomaji?: string; signal?: AbortSignal },
): Promise<string | null> {
  const { author, malId, titleRomaji, signal } = options ?? {}
  try {
    const result = await get<{ frenchTitle: string }>(
      `/metadata/french-title${buildQuery({ entityTypeId, query, author, malId, titleRomaji })}`,
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
 * deux manque. `titleRomaji` est essayé en repli d'`originalTitle` pour
 * cette même détection (voir fetchFrenchTitle ci-dessus). */
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
  },
): Promise<VolumesResponseDto> {
  const { author, signal, forceRefresh, deepSearch, malId, originalTitle, titleRomaji } = options ?? {}
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
    })}`,
    signal,
  )
}
