import type { EntityResponse, OwnershipResponse } from '../../types/api'

/** Modèle Tome != Ownership (voir backend, étapes 4-8) : un Variant catalogué
 * n'est pas forcément possédé (ex: exemplaire revendu dont l'Ownership a été
 * supprimée, mais dont le Tome reste connu). "Ma collection" montre ce que
 * l'utilisateur possède RÉELLEMENT, jamais tout ce qui est catalogué -
 * l'inverse ("ce qui manque") est le rôle de la fiche Série, pas de cet écran. */
export function ownedVariantIds(ownerships: OwnershipResponse[]): Set<string> {
  const ids = new Set<string>()
  for (const o of ownerships) {
    if (o.status === 'OWNED' && o.variantId) ids.add(o.variantId)
  }
  return ids
}

/** true si l'Entity a au moins une possession active - pour une Entity sans
 * notion de tome (jeu vidéo/société), l'Ownership est directement rattachée
 * à l'Entity (variantId absent), voir QuickAddService côté backend. */
export function isOwned(entity: EntityResponse, ownerships: OwnershipResponse[], owned: Set<string>): boolean {
  if (entity.variants.length > 0) {
    return entity.variants.some((v) => owned.has(v.id))
  }
  return ownerships.some((o) => o.entityId === entity.id && o.status === 'OWNED')
}
