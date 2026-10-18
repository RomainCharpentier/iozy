// Optional attributes returned by Jikan/MyAnimeList when adding
// (see JikanMetadataProvider/MyAnimeListMetadataProvider on the backend side) -
// absent for a series added by free entry, or added before these
// attributes existed (no retroactive catch-up).

/** "Publishing"/"Finished"/... (Jikan) or "currently_publishing"/"finished"/... (MyAnimeList v2) - two different vocabularies for the same concept, never unified on the backend side (each source keeps its original format). */
const SERIES_STATUS_ATTRIBUTE_KEY = 'seriesStatus'

/** Total number of published volumes, known only for series for which Jikan/MyAnimeList has closed the count (never stored for a series still ongoing, see the two providers). */
const TOTAL_VOLUMES_ATTRIBUTE_KEY = 'totalVolumes'

export function totalVolumesFrom(attributes: Record<string, unknown> | undefined): number | null {
  const value = attributes?.[TOTAL_VOLUMES_ATTRIBUTE_KEY]
  return typeof value === 'number' && value > 0 ? value : null
}

/** null = unknown status (attribute absent, or value neither "ongoing" nor "finished" on the source side, e.g. "on_hiatus"/"discontinued") - never claim a status that is not really known. */
export function isSeriesOngoing(attributes: Record<string, unknown> | undefined): boolean | null {
  const value = attributes?.[SERIES_STATUS_ATTRIBUTE_KEY]
  if (typeof value !== 'string') return null
  const normalized = normaliserStatut(value)
  if (normalized === 'finished') return false
  // AniList writes RELEASING (see SeriesStatus on the backend side, which
  // reads the three vocabularies the same way).
  if (normalized === 'publishing' || normalized === 'currentlypublishing' || normalized === 'releasing') return true
  return null
}

/** Letters only, lower case: "currently_publishing", "On Hiatus" and
 *  "NOT_YET_RELEASED" become comparable - the rule of SeriesStatus. */
function normaliserStatut(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

const LIBELLES_STATUT: Record<string, string> = {
  finished: 'Terminée',
  publishing: 'En cours',
  currentlypublishing: 'En cours',
  releasing: 'En cours',
  onhiatus: 'En pause',
  hiatus: 'En pause',
  discontinued: 'Arrêtée',
  cancelled: 'Arrêtée',
  notyetpublished: 'À paraître',
  notyetreleased: 'À paraître',
}

/**
 * The publication status as a reader says it, in French. The stored value
 * stays the provider's own ("FINISHED", "Publishing", "on_hiatus"): only its
 * display is translated. A value no provider is known to write is shown as
 * it is rather than hidden - it is still what the source said.
 */
export function libelleStatutSerie(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  return LIBELLES_STATUT[normaliserStatut(value)] ?? value
}
