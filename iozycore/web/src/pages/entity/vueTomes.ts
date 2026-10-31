import { useSyncExternalStore } from 'react'

/**
 * How the volumes of a detail page are shown: standing on a shelf, or as a
 * grid of covers. Remembered on this device, like the theme (see lib/theme).
 *
 * <p>The shelf is the default (batch 195): it is the reading the owner
 * asked for, the one where a missing volume is a hole between two spines.
 * The grid stays one click away for whoever wants the covers in full.
 */
export type VueTomes = 'etagere' | 'grille'

const CLE = 'iozycore.vueTomes'
const DEFAUT: VueTomes = 'etagere'

function lire(): VueTomes {
  try {
    const brut = window.localStorage.getItem(CLE)
    return brut === 'grille' || brut === 'etagere' ? brut : DEFAUT
  } catch {
    return DEFAUT
  }
}

let vueCourante: VueTomes = typeof window === 'undefined' ? DEFAUT : lire()
const abonnes = new Set<() => void>()

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

export function definirVueTomes(vue: VueTomes): void {
  vueCourante = vue
  try {
    window.localStorage.setItem(CLE, vue)
  } catch {
    // Storage refused: the page keeps the choice until the next opening.
  }
  for (const rappel of abonnes) rappel()
}

export function useVueTomes(): [VueTomes, (vue: VueTomes) => void] {
  const vue = useSyncExternalStore(souscrire, () => vueCourante, () => DEFAUT)
  return [vue, definirVueTomes]
}
