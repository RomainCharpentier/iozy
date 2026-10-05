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
  const normalized = value.toLowerCase()
  if (normalized === 'finished') return false
  if (normalized === 'publishing' || normalized === 'currently_publishing') return true
  return null
}
