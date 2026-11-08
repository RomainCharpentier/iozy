import type {
  CollectorStatus,
  EditionProgressDto,
  OwnershipResponse,
  WorkDto,
  WorkElementDto,
  WorkNextReleaseDto,
} from '@/common/types/api'
import type { WishlistTarget } from '@/common/api/wishlist'
import { libelleJour, libelleMois, parseReleaseDate } from '@/common/lib/releaseDate'
import { formaterEuros } from '@/common/lib/formats'

/**
 * What the entity page reads from a work (lot 213), whatever its type.
 *
 * <h2>No universe named here</h2>
 * A custom type must get the same page as a manga. So nothing below asks for a
 * type code: the gestures follow what the data says it can do (an element the
 * source declares ownable, a work counted in numbered editions), and the shape
 * follows what the type declares (see declaredAspectClassName).
 */

/** The key the core gives a work owned as a single piece (DefaultWorkElements.WHOLE_WORK_KEY). */
export const CLE_OEUVRE_ENTIERE = 'work'

/**
 * What a click on an element not owned does.
 * - `numero`: the work is counted in numbered editions, so the element is
 *   added by its number, the path every volume took so far (quick-add);
 * - `element`: the source says the element can be owned in one click
 *   (POST /works/{id}/elements/{key}/own);
 * - `oeuvre`: the element is the work itself, added whole;
 * - null: nothing on this server can own it in one click. It stays drawn,
 *   without a gesture that would fail.
 */
export type GesteJeLAi = 'numero' | 'element' | 'oeuvre' | null

export function gesteJeLAi(element: WorkElementDto, compteParEditions: boolean): GesteJeLAi {
  if (element.state === 'OWNED') return null
  // Lot 211's route owns what is missing, never what is still to come.
  if (element.ownable && element.state === 'MISSING') return 'element'
  if (element.key === CLE_OEUVRE_ENTIERE) return 'oeuvre'
  if (compteParEditions && element.number !== null) return 'numero'
  return null
}

/** The status of the collector, in the words of the page. */
export const LIBELLES_STATUT: Record<CollectorStatus, string> = {
  ONGOING: 'En cours',
  PAUSED: 'En pause',
  DROPPED: 'Abandonnée',
}

/**
 * The line under the count: what is missing, or why nothing is counted.
 * A paused or dropped work still shows its gaps, but says it counts none.
 */
export function phraseDesManques(work: WorkDto): string {
  if (work.collectorStatus !== 'ONGOING') {
    return `${LIBELLES_STATUT[work.collectorStatus]} : ce qui manque ne compte plus`
  }
  if (work.missingCount > 0) return `Il t’en manque ${work.missingCount}`
  if (work.totalKnown && work.totalCount !== null && work.ownedCount >= work.totalCount) return 'Complet'
  return 'Rien ne manque à ce qui est connu'
}

/** The count said in words: "1 possédé sur 6", "3 possédés, total inconnu". */
export function phraseDuCompte(work: WorkDto): string {
  const possedes = `${work.ownedCount} ${work.ownedCount > 1 ? 'possédés' : 'possédé'}`
  return work.totalCount !== null ? `${possedes} sur ${work.totalCount}` : `${possedes}, total inconnu`
}

/** "Tome 15 · vendredi 4 décembre · 7,95 €", or "Sort en décembre 2026" for the work itself. */
export function phraseProchaineSortie(sortie: WorkNextReleaseDto): string {
  const parts = parseReleaseDate(sortie.date)
  const quand = !parts
    ? sortie.date
    : parts.precision === 'DAY'
      ? libelleJour(sortie.date)
      : libelleMois(sortie.date).toLowerCase()
  const prix = sortie.price !== null ? formaterEuros(sortie.price) : null
  if (!sortie.label) {
    const phrase = parts?.precision === 'DAY' ? `Sort le ${quand}` : `Sort en ${quand}`
    return [phrase, prix].filter(Boolean).join(' · ')
  }
  return [sortie.label, quand, prix].filter(Boolean).join(' · ')
}

/**
 * The edition the works read model counts: the followed one, else the one
 * with the most owned volumes, else the first (the catalog lists the fullest
 * first). The same order as the server (MangaWorkElements.chosenEdition), so
 * the total typed on the page lands on the edition the count shows.
 */
export function editionComptee(
  editions: EditionProgressDto[],
  editionSuivie: string | null,
): EditionProgressDto | null {
  if (editions.length === 0) return null
  const normaliser = (nom: string) => nom.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
  if (editionSuivie && editionSuivie.trim()) {
    const suivie = editions.find((e) => normaliser(e.editionName) === normaliser(editionSuivie))
    if (suivie) return suivie
  }
  let meilleure = editions[0]
  for (const candidate of editions) {
    if (candidate.ownedVolumeNumbers.length > meilleure.ownedVolumeNumbers.length) meilleure = candidate
  }
  return meilleure
}

/** Where a known total comes from, said in one short phrase. */
export function provenanceDuTotal(edition: EditionProgressDto | null): string | null {
  if (!edition || edition.totalVolumes === null) return null
  if (edition.totalSource === 'MANUAL') return 'saisi par toi'
  if (edition.totalSource === 'PROVIDER') return 'd’après les listes françaises'
  return null
}

/** The elements a "mettre de côté" gesture would add to the wishes: missing, counted, not wished yet. */
export function elementsAMettreDeCote(work: WorkDto): WorkElementDto[] {
  if (work.collectorStatus !== 'ONGOING') return []
  return work.elements.filter((e) => e.state === 'MISSING' && e.countedAsMissing)
}

/**
 * Each element "mettre de côté" can really wish, with its wish: by its catalog
 * variant, or by its number in the edition the work is counted in. An element
 * with neither is left out, so the label always names an element that is sent.
 */
export function ciblesAMettreDeCote(
  work: WorkDto,
  compteParEditions: boolean,
  edition: string | undefined,
): { element: WorkElementDto; cible: WishlistTarget }[] {
  return elementsAMettreDeCote(work).flatMap((element): { element: WorkElementDto; cible: WishlistTarget }[] =>
    element.variantId
      ? [{ element, cible: { entityId: work.entityId, variantId: element.variantId } }]
      : compteParEditions && element.number !== null
        ? [{ element, cible: { entityId: work.entityId, volumeNumber: element.number, edition } }]
        : [],
  )
}

/**
 * The copies a removal of this element deletes, among the copies of this
 * entity: every active copy of its variant, or every active copy of the whole
 * work (a game owned on two consoles). Empty when the copy lives elsewhere
 * (an element derived from another entity): then nothing here can remove it.
 */
export function copiesARetirer(element: WorkElementDto, copies: OwnershipResponse[]): OwnershipResponse[] {
  if (element.state !== 'OWNED') return []
  return copies.filter((copie) => {
    if (copie.status !== 'OWNED') return false
    if (element.variantId) return copie.variantId === element.variantId
    if (element.key === CLE_OEUVRE_ENTIERE) return !copie.variantId
    return copie.id === element.ownershipId
  })
}
