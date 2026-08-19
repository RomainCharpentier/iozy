import type { Rank } from '../types/tierList'

/** Couleur de fond d'un rang (voir index.css, --color-rank-*) - la LETTRE
 * porte l'information, la couleur ne fait que la renforcer (voir DS v1.1 :
 * "un rang reste compréhensible en niveaux de gris"). */
export function rankColorVar(rank: Rank): string {
  return `var(--color-rank-${rank.toLowerCase()})`
}

/** Encre du badge - toujours blanche en thème clair (fonds de rang foncés),
 * toujours sombre en thème foncé (fonds de rang éclaircis) - voir DS v1.1,
 * rankInk. Un seul jeu de classes suffit car chaque thème a sa propre
 * palette de fonds déjà calibrée pour ce contraste fixe. */
export const RANK_INK_LIGHT = '#ffffff'
export const RANK_INK_DARK = '#231e19'
