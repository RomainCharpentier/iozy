import type { EntityResponse, OwnershipResponse, WishlistEntryResponse } from '@/common/types/api'
import type { TriCollection } from '@/common/lib/preferencesCollection'

/**
 * "Since when" each object is here - what the "Récents
 * d'abord" sort is based on.
 *
 * <h2>Two dates, one single question</h2>
 * An owned volume came on its acquisition date, a wished volume on the date of
 * the wish. These are two columns of two tables, but one single thing from the point
 * of view of the screen: when did this object enter my collection, in the broad
 * sense? Hence a single index, and the ownership wins when both
 * exist - having comes after wanting.
 *
 * <p>Extracted from ShelfPage because the category view needs it too:
 * it offered "Récents d'abord" without being able to honor it, for lack of these dates.
 * A control that does nothing is worse than no control.
 */
interface Venues {
  parTome: Map<string, string>
  parOeuvre: Map<string, string>
}

export function indexerVenues(ownerships: OwnershipResponse[], envies: WishlistEntryResponse[]): Venues {
  const parTome = new Map<string, string>()
  const parOeuvre = new Map<string, string>()
  for (const o of ownerships) {
    if (o.status !== 'OWNED') continue
    if (o.variantId) parTome.set(o.variantId, o.acquiredAt)
    else parOeuvre.set(o.entityId, o.acquiredAt)
  }
  // `has` first: an ownership, when it exists, tells better than the wish
  // since when the object is here.
  for (const entree of envies) {
    if (entree.variantId) {
      if (!parTome.has(entree.variantId)) parTome.set(entree.variantId, entree.addedAt)
    } else if (!parOeuvre.has(entree.entityId)) {
      parOeuvre.set(entree.entityId, entree.addedAt)
    }
  }
  return { parTome, parOeuvre }
}

/**
 * The most RECENT arrival among the volumes of a work.
 *
 * This is what moves when a volume is added to an old series - and therefore what
 * one expects to see go to the top. Taking the oldest would do
 * the opposite: a series started two years ago would stay at the bottom whatever is
 * added to it.
 */
function derniereVenue(entity: EntityResponse, venues: Venues): string {
  let derniere = venues.parOeuvre.get(entity.id) ?? ''
  for (const variant of entity.variants) {
    const venue = venues.parTome.get(variant.id)
    if (venue && venue > derniere) derniere = venue
  }
  return derniere
}

/** The sort of the WORKS, common to My collection and to the category view. */
export function trierOeuvres(entities: EntityResponse[], tri: TriCollection, venues: Venues): EntityResponse[] {
  if (tri === 'titre') {
    return [...entities].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  }
  return [...entities].sort((a, b) => derniereVenue(b, venues).localeCompare(derniereVenue(a, venues)))
}
