/**
 * The two letters that an avatar carries in place of a photo.
 *
 * <h2>Why a written rule rather than a `slice(0, 2)`</h2>
 * A username can be one word ("kenshin"), or two separate pieces
 * ("jean-dupont", "marie_c", "r.charpentier"). Cut by character, the second
 * gives "JE" — the start of the first name twice, and two people of the same
 * family become indistinguishable. Cut at the separators, it gives "JD",
 * which is what is expected from an avatar.
 *
 * <p>The separators are the ones the username allows (see `AppUser` on the
 * server side: dot, hyphen, underscore) — the space is refused there, but is
 * still split here: this function also serves names that do not come from a
 * username, and a "Jean Dupont" must not give "JE".
 *
 * <h2>`Array.from`, and not `[0]`</h2>
 * A username accepts any Unicode letter, and some are written on two code
 * units. `pseudo[0]` would render half of it — a replacement character on
 * the screen, on the most visible element of the header.
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
