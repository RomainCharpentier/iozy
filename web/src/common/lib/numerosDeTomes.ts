/**
 * "11, 48, 51 à 74": a list of volume numbers readable at a glance.
 *
 * A run of three or more numbers reads in one go; two consecutive numbers
 * stay written as they are ("1, 2" rather than "1 à 2"). Duplicates
 * disappear, the order is the one of the numbers.
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
