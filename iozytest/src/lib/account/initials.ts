/** Les initiales d'un pseudo, pour l'avatar de la barre du haut : la première
 *  lettre de deux morceaux, ou les deux premières lettres d'un seul
 *  (« jean-dupont » → JD, « kenshin » → KE). Même règle qu'IozyCore
 *  (`common/lib/initiales.ts`), pour que l'avatar soit le même partout. */
export function initialsOf(pseudo: string): string {
  const parts = pseudo.trim().split(/[-_. ]+/).filter(Boolean)
  if (parts.length === 0) return ''
  const letters =
    parts.length >= 2 ? [Array.from(parts[0])[0], Array.from(parts[1])[0]] : Array.from(parts[0]).slice(0, 2)
  return letters.join('').toLocaleUpperCase('fr')
}
