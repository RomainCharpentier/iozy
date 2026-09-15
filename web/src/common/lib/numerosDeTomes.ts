/**
 * « 11, 48, 51 à 74 » : une liste de numéros de tomes lisible d'un coup d'œil.
 *
 * Une suite de trois numéros ou plus se lit d'un trait ; deux numéros qui se
 * suivent restent écrits tels quels (« 1, 2 » plutôt que « 1 à 2 »). Les
 * doublons disparaissent, l'ordre est celui des numéros.
 */
export function resumerNumeros(numeros: number[]): string {
  const tries = [...new Set(numeros)].sort((a, b) => a - b)
  const parties: string[] = []
  let debut = 0
  for (let i = 1; i <= tries.length; i++) {
    if (i === tries.length || tries[i] !== tries[i - 1] + 1) {
      const longueur = i - debut
      if (longueur >= 3) parties.push(`${tries[debut]} à ${tries[i - 1]}`)
      else parties.push(...tries.slice(debut, i).map(String))
      debut = i
    }
  }
  return parties.join(', ')
}
