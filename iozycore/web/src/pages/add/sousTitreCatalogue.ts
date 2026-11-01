import { creatorFrom } from '@/common/lib/creatorInfo'

/**
 * The year a work carries, whatever its universe gave it: `startYear`
 * (manga, from Jikan/AniList), `yearPublished` (board game, from BGG) or
 * the year of `releaseDate` (video game, from IGDB). Four digits, or nothing.
 */
function anneeDe(attributes: Record<string, unknown> | undefined): string | undefined {
  for (const cle of ['startYear', 'yearPublished', 'releaseDate']) {
    const valeur = attributes?.[cle]
    const texte = typeof valeur === 'number' ? String(valeur) : typeof valeur === 'string' ? valeur.trim() : ''
    const annee = /^(\d{4})/.exec(texte)?.[1]
    if (annee) return annee
  }
  return undefined
}

/**
 * The line under a title on the catalogue (lot 198): "1989 · Kentarou Miura",
 * "2017 · R. Eric Reuss", "Nintendo". Only what the work really carries -
 * a tile with nothing to say under its title says nothing, it does not
 * invent a dash.
 */
export function sousTitreCatalogue(attributes: Record<string, unknown> | undefined): string | undefined {
  const parts = [anneeDe(attributes), creatorFrom(attributes)].filter((part): part is string => !!part)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
