import type { EditionProgressDto, VariantDto } from '../types/api'

/**
 * La construction de la grille d'une edition : quels numeros existent, et
 * dans quel etat.
 *
 * Extrait de l'ancien TomesGridSection (supprime) parce que trois surfaces le
 * lisent desormais - la grille dense, le resume de l'edition affichee et les
 * cartes d'edition - et qu'aucune ne doit avoir sa propre idee de ce qu'est
 * un tome possede.
 */
export interface TomeTile {
  volumeNumber: number
  status: 'owned' | 'cataloguedMissing' | 'virtualMissing'
  variant?: VariantDto
}

/** Construit la grille visuelle d'une édition : un possédé (Ownership active)
 * n'est jamais confondu avec un simplement catalogué (modèle Tome !=
 * Ownership) ni avec un purement virtuel (numéro déduit de totalVolumes,
 * jamais catalogué). Sans totalVolumes connu, on ne montre que ce qu'on
 * connaît réellement (possédé ou catalogué) - jamais de tuile virtuelle
 * devinée sans un total sur lequel s'appuyer.
 *
 * <p>Tout vient du MÊME `groupe` (voir GET /insights/progress/{entityId}) :
 * possédés, catalogués et total. Auparavant ces trois-là arrivaient de trois
 * endroits - un regroupement refait ici, une lecture des Ownership refaite
 * ici, et un appel à la complétude - qui pouvaient se contredire.
 *
 * <p>Un Variant existant vaut « catalogué » quoi qu'en dise la liste des
 * catalogués, qui vient d'une réponse réseau pouvant dater : c'est ce qui fait
 * qu'un tome mis en envies à l'instant (et donc catalogué à l'instant, voir
 * TomeResolver) porte immédiatement son état au lieu de retomber en tuile
 * purement déduite, sans identité à laquelle rattacher l'envie. */
export function buildTiles(group: EditionProgressDto, variants: VariantDto[]): TomeTile[] {
  const owned = group.ownedVolumeNumbers
  const totalVolumes = group.totalVolumes
  const variantsByNumber = new Map<number, VariantDto>()
  // group.sourceEditions plutôt que group.edition seul : un groupe fusionné
  // (voir resolveEditionView) doit retrouver le Variant d'un tome sans
  // édition précisée aussi bien que celui de l'édition nommée.
  const sourceSet = new Set(group.sourceEditions)
  for (const variant of variants) {
    const num = variant.attributes.volumeNumber
    const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    if (typeof num === 'number' && sourceSet.has(edition)) variantsByNumber.set(num, variant)
  }
  const ownedSet = new Set(owned)

  if (totalVolumes === null) {
    return group.cataloguedVolumeNumbers.map((n) => ({
      volumeNumber: n,
      status: ownedSet.has(n) ? ('owned' as const) : ('cataloguedMissing' as const),
      variant: variantsByNumber.get(n),
    }))
  }

  // « Catalogué mais pas possédé » se déduit, plutôt que de se redemander au
  // serveur : c'est exactement la différence des deux listes du groupe.
  const cataloguedMissingSet = new Set(group.cataloguedVolumeNumbers.filter((n) => !ownedSet.has(n)))
  const tiles: TomeTile[] = []
  for (let n = 1; n <= totalVolumes; n++) {
    if (ownedSet.has(n)) {
      tiles.push({ volumeNumber: n, status: 'owned', variant: variantsByNumber.get(n) })
    } else if (cataloguedMissingSet.has(n) || variantsByNumber.has(n)) {
      tiles.push({ volumeNumber: n, status: 'cataloguedMissing', variant: variantsByNumber.get(n) })
    } else {
      tiles.push({ volumeNumber: n, status: 'virtualMissing' })
    }
  }

  // Tomes réellement catalogués/possédés AU-DELÀ du total connu de l'édition :
  // affichés à la suite plutôt qu'escamotés. Le cas existe dès qu'un tome est
  // ajouté à la main avec un numéro trop grand - les masquer rendait la donnée
  // invisible ET irrécupérable depuis l'écran, d'autant qu'il n'existe plus de
  // moyen de renuméroter un tome (voir USER_JOURNEYS §20) : le seul recours est
  // de le supprimer et de le rajouter, encore faut-il le voir. Un total
  // d'édition peut aussi être faux : mieux vaut montrer la contradiction.
  const beyondTotal = [...new Set([...owned, ...group.cataloguedVolumeNumbers])]
    .filter((n) => n > totalVolumes)
    .sort((a, b) => a - b)
  for (const n of beyondTotal) {
    tiles.push({
      volumeNumber: n,
      status: ownedSet.has(n) ? 'owned' : 'cataloguedMissing',
      variant: variantsByNumber.get(n),
    })
  }
  return tiles
}

/** "Tome 12" si un numéro de tome est exploitable, sinon le label brut - même
 *  règle que ShelfPage.variantSubtitle, gardée cohérente ici. */
export function variantLabel(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}
