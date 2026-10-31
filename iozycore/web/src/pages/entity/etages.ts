/** The width of a spine, the gap between two, and the margin inside a shelf (see Etagere). */
export const LARGEUR_DOS = 22
export const ECART_DOS = 4
export const MARGE_ETAGE = 18

/**
 * How many spines one shelf of this width holds.
 *
 * <p>Unmeasured (the first paint, the test runner): one wide shelf. The
 * floor of eight keeps a very narrow screen from making one shelf per
 * volume.
 */
export function dosParEtage(largeur: number): number {
  if (largeur <= 0) return 48
  return Math.max(8, Math.floor((largeur - 2 * MARGE_ETAGE + ECART_DOS) / (LARGEUR_DOS + ECART_DOS)))
}

/**
 * Where the cover opens, relative to its spine: centered, unless the spine
 * sits near an end of the shelf - the cover (112 px) and its pill would
 * then stick out of the page, and a hidden element that sticks out still
 * widens the page (measured: 409 px for 390 on a phone).
 */
export function coteDeLaCarte(index: number, longueur: number): 'gauche' | 'centre' | 'droite' {
  // A short shelf (the last one) has room on its right: everything opens
  // to the right of its spine. Aligning its last spines to the right made
  // their cover start before the page (measured: 46 px to the left).
  if (index < 4 || longueur <= 8) return 'gauche'
  if (index >= longueur - 4) return 'droite'
  return 'centre'
}

/** The volumes, shelf by shelf, in reading order. */
export function repartirEnEtages<T>(volumes: T[], parEtage: number): T[][] {
  const etages: T[][] = []
  for (let debut = 0; debut < volumes.length; debut += parEtage) {
    etages.push(volumes.slice(debut, debut + parEtage))
  }
  return etages
}
