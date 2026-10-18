import type { EntityResponse, OwnershipResponse } from '@/common/types/api'

/** Volume model != Ownership (see backend, steps 4-8): a cataloged Variant
 * is not necessarily owned (e.g. a resold copy whose Ownership was
 * deleted, but whose Volume is still known). "Ma collection" shows what the
 * user REALLY owns, never everything that is cataloged - the opposite
 * ("what is missing") is the role of the Series detail page, not of this
 * screen. */
export function ownedVariantIds(ownerships: OwnershipResponse[]): Set<string> {
  const ids = new Set<string>()
  for (const o of ownerships) {
    if (o.status === 'OWNED' && o.variantId) ids.add(o.variantId)
  }
  return ids
}

/** true if the Entity has at least one active ownership - for an Entity
 * without a notion of volume (video game/board game), the Ownership is
 * attached directly to the Entity (variantId absent), see QuickAddService on
 * the backend side. */
export function isOwned(entity: EntityResponse, ownerships: OwnershipResponse[], owned: Set<string>): boolean {
  if (entity.variants.length > 0) {
    return entity.variants.some((v) => owned.has(v.id))
  }
  return ownerships.some((o) => o.entityId === entity.id && o.status === 'OWNED')
}
