// Attributs optionnels remontés par Jikan/MyAnimeList lors de l'ajout
// (voir JikanMetadataProvider/MyAnimeListMetadataProvider côté backend) -
// absents pour une série ajoutée en saisie libre, ou ajoutée avant que ces
// attributs n'existent (pas de rattrapage rétroactif).

/** "Publishing"/"Finished"/... (Jikan) ou "currently_publishing"/"finished"/... (MyAnimeList v2) - deux vocabulaires différents pour le même concept, jamais unifiés côté backend (chaque source garde son format d'origine). */
const SERIES_STATUS_ATTRIBUTE_KEY = 'seriesStatus'

/** Nombre total de tomes publiés, connu seulement pour les séries dont Jikan/MyAnimeList a arrêté le décompte (jamais stocké pour une série encore en cours, voir les deux providers). */
const TOTAL_VOLUMES_ATTRIBUTE_KEY = 'totalVolumes'

export function totalVolumesFrom(attributes: Record<string, unknown> | undefined): number | null {
  const value = attributes?.[TOTAL_VOLUMES_ATTRIBUTE_KEY]
  return typeof value === 'number' && value > 0 ? value : null
}

/** null = statut inconnu (attribut absent, ou valeur ni "en cours" ni "terminée" côté source, ex: "on_hiatus"/"discontinued") - ne jamais affirmer un statut qu'on ne connaît pas vraiment. */
export function isSeriesOngoing(attributes: Record<string, unknown> | undefined): boolean | null {
  const value = attributes?.[SERIES_STATUS_ATTRIBUTE_KEY]
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized === 'finished') return false
  if (normalized === 'publishing' || normalized === 'currently_publishing') return true
  return null
}
