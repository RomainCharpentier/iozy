import type { ReactNode } from 'react'
import { formatReleaseDate, RELEASE_DATE_ATTRIBUTE_KEY } from '@/common/lib/releaseDate'
import { creatorFrom } from '@/common/lib/creatorInfo'

export interface Fait {
  libelle: string
  valeur: ReactNode
  /** A field needs the room of two cards: a console name must not be cut. */
  large?: boolean
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : null
}

function nombre(valeur: unknown): number | null {
  return typeof valeur === 'number' && valeur > 0 ? valeur : null
}

function joueurs(attributes: Record<string, unknown>): string | null {
  const min = nombre(attributes.minPlayers)
  const max = nombre(attributes.maxPlayers)
  if (min && max) return min === max ? `${min}` : `${min} à ${max}`
  return min ? `${min} et plus` : max ? `Jusqu'à ${max}` : null
}

/**
 * What the work IS, when it has no volumes to show: for a game, these few facts
 * are the page. Only what the source really gave: a fact that is not known
 * has no card, it does not get a dash.
 */
export function faitsDeLOeuvre(code: string | undefined, attributes: Record<string, unknown>): Fait[] {
  const sortie = texte(attributes[RELEASE_DATE_ATTRIBUTE_KEY])
  const duree = nombre(attributes.averageDurationMinutes)
  const candidats: [string, ReactNode][] =
    code === 'BOARD_GAME'
      ? [
          ['Joueurs', joueurs(attributes)],
          ['Durée', duree ? `${duree} min` : null],
          ['Éditeur', texte(attributes.publisher)],
          ['Auteur', texte(attributes.designers)],
          ['Année', texte(attributes.yearPublished)],
        ]
      : code === 'VIDEO_GAME'
        ? [
            ['Éditeur', texte(attributes.publisher)],
            ['Studio', texte(attributes.studio)],
            ['Sortie', sortie ? formatReleaseDate(sortie) : null],
          ]
        : [
            ['Auteur', creatorFrom(attributes)],
            ['Éditeur', texte(attributes.publisher)],
            ['Sortie', sortie ? formatReleaseDate(sortie) : null],
          ]
  return candidats.filter(([, valeur]) => Boolean(valeur)).map(([libelle, valeur]) => ({ libelle, valeur }))
}
