/** The gap between two spines, and the margin inside a shelf (see Etagere). */
export const ECART_DOS = 2
export const MARGE_ETAGE = 6

/** Under this width, the shelf has the sizes of a phone. */
const LARGEUR_TELEPHONE = 480

/** The size of a spine: the same for every series, so that a shelf reads like a shelf. */
export function formatEtagere(largeur: number): { dos: number; hauteur: number } {
  return largeur > 0 && largeur <= LARGEUR_TELEPHONE ? { dos: 22, hauteur: 150 } : { dos: 32, hauteur: 196 }
}

/**
 * How many spines one shelf of this width holds.
 *
 * <p>Unmeasured (the first paint, the test runner): one wide shelf. The floor
 * keeps a very narrow screen from making one shelf per volume.
 */
export function dosParEtage(largeur: number, dos: number): number {
  if (largeur <= 0) return 48
  return Math.max(6, Math.floor((largeur - 2 * MARGE_ETAGE + ECART_DOS) / (dos + ECART_DOS)))
}

/** The volumes, shelf by shelf, in reading order. */
export function repartirEnEtages<T>(volumes: T[], parEtage: number): T[][] {
  const etages: T[][] = []
  for (let debut = 0; debut < volumes.length; debut += parEtage) {
    etages.push(volumes.slice(debut, debut + parEtage))
  }
  return etages
}

/** A spine cut from the cover of the series is taken at another place for each number. */
export function positionTranche(numero: number, aSaJaquette: boolean): number {
  return aSaJaquette ? 15 : 22 + (numero * 17) % 56
}

/** "3", "3 à 5", "1, 3 à 5 et 8": what a person says of these volumes. */
export function plageDeTomes(numeros: number[]): string {
  const tries = [...new Set(numeros)].sort((a, b) => a - b)
  const morceaux: string[] = []
  for (let i = 0; i < tries.length; i++) {
    let fin = i
    while (tries[fin + 1] === tries[fin] + 1) fin++
    morceaux.push(i === fin ? `${tries[i]}` : `${tries[i]} à ${tries[fin]}`)
    i = fin
  }
  return morceaux.length > 1
    ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`
    : (morceaux[0] ?? '')
}
