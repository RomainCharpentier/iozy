import type { EntityResponse, OwnershipResponse, WishlistEntryResponse } from '@/common/types/api'
import type { TriCollection } from '@/common/lib/preferencesCollection'

/**
 * « Depuis quand » chaque objet est là - ce sur quoi porte le tri « Récents
 * d'abord ».
 *
 * <h2>Deux dates, une seule question</h2>
 * Un tome possédé est venu à sa date d'acquisition, un tome voulu à la date de
 * l'envie. Ce sont deux colonnes de deux tables, mais une seule chose du point
 * de vue de l'écran : quand cet objet est-il entré dans ma collection, au sens
 * large ? D'où un index unique, et la possession qui l'emporte quand les deux
 * existent - avoir est postérieur à vouloir.
 *
 * <p>Extrait de ShelfPage parce que la vue d'une catégorie en a besoin aussi :
 * elle offrait « Récents d'abord » sans pouvoir l'honorer, faute de ces dates.
 * Un contrôle qui ne fait rien est pire que pas de contrôle.
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
  // `has` d'abord : une possession, quand elle existe, dit mieux que l'envie
  // depuis quand l'objet est là.
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
 * La venue la plus RÉCENTE parmi les tomes d'une œuvre.
 *
 * C'est ce qui bouge quand on ajoute un tome à une vieille série - et donc ce
 * qu'on s'attend à voir remonter en tête. Prendre la plus ancienne ferait
 * l'inverse : une série entamée il y a deux ans resterait au fond quoi qu'on y
 * ajoute.
 */
function derniereVenue(entity: EntityResponse, venues: Venues): string {
  let derniere = venues.parOeuvre.get(entity.id) ?? ''
  for (const variant of entity.variants) {
    const venue = venues.parTome.get(variant.id)
    if (venue && venue > derniere) derniere = venue
  }
  return derniere
}

/** Le tri des ŒUVRES, commun à Ma collection et à la vue d'une catégorie. */
export function trierOeuvres(entities: EntityResponse[], tri: TriCollection, venues: Venues): EntityResponse[] {
  if (tri === 'titre') {
    return [...entities].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  }
  return [...entities].sort((a, b) => derniereVenue(b, venues).localeCompare(derniereVenue(a, venues)))
}
