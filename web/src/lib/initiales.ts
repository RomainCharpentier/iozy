/**
 * Les deux lettres qu'un avatar porte à la place d'une photo.
 *
 * <h2>Pourquoi une règle écrite plutôt qu'un `slice(0, 2)`</h2>
 * Un pseudo peut être un mot (« kenshin »), ou deux morceaux séparés
 * (« jean-dupont », « marie_c », « r.charpentier »). Découpé au caractère, le
 * second donne « JE » — le début du prénom deux fois, et deux personnes de la
 * même famille deviennent indistinguables. Découpé aux séparateurs, il donne
 * « JD », qui est ce qu'on attend d'un avatar.
 *
 * <p>Les séparateurs sont ceux que le pseudo autorise (voir `AppUser` côté
 * serveur : point, tiret, tiret bas) — l'espace y est refusé, mais reste
 * découpé ici : cette fonction sert aussi à des noms qui ne viennent pas d'un
 * pseudo, et un « Jean Dupont » ne doit pas rendre « JE ».
 *
 * <h2>`Array.from`, et pas `[0]`</h2>
 * Un pseudo accepte n'importe quelle lettre Unicode, et certaines s'écrivent
 * sur deux unités de code. `pseudo[0]` en rendrait la moitié — un caractère de
 * remplacement à l'écran, sur l'élément le plus visible de l'en-tête.
 */
const SEPARATEURS = /[-_. ]+/

export function initiales(pseudo: string): string {
  const morceaux = (pseudo ?? '').trim().split(SEPARATEURS).filter((morceau) => morceau.length > 0)
  if (morceaux.length === 0) return ''

  const lettres =
    morceaux.length >= 2
      ? [premiereLettre(morceaux[0]), premiereLettre(morceaux[1])]
      : Array.from(morceaux[0]).slice(0, 2)

  return lettres.join('').toLocaleUpperCase('fr')
}

function premiereLettre(morceau: string): string {
  return Array.from(morceau)[0] ?? ''
}
