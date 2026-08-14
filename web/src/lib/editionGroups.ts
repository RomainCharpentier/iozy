import type { OwnershipResponse, VariantDto } from '../types/api'

export interface EditionGroup {
  /** "" = tomes sans édition précisée (jamais compté comme une édition distincte, voir groupVariantsByEdition). */
  edition: string
  volumeNumbers: number[]
}

/** Regroupe les tomes d'une série par édition déclarée (attribut "edition"
 * du Variant, voir QuickAddService côté backend) - un tome sans édition
 * précisée rejoint le groupe "" plutôt que de compter comme une édition à
 * part entière (on ne sait juste pas laquelle, ce n'est pas "une autre"). */
export function groupVariantsByEdition(variants: VariantDto[]): EditionGroup[] {
  const groups = new Map<string, number[]>()
  for (const variant of variants) {
    const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    const volumeNumber = variant.attributes.volumeNumber
    if (typeof volumeNumber !== 'number') continue
    const list = groups.get(edition) ?? []
    list.push(volumeNumber)
    groups.set(edition, list)
  }
  return Array.from(groups.entries())
    .map(([edition, volumeNumbers]) => ({ edition, volumeNumbers: volumeNumbers.sort((a, b) => a - b) }))
    .sort((a, b) => b.volumeNumbers.length - a.volumeNumbers.length)
}

/** true seulement s'il existe 2+ éditions NOMMÉES distinctes - le groupe ""
 * (tomes sans édition précisée) ne compte jamais comme une édition en soi,
 * pour ne pas signaler à tort un mélange sur une simple absence de saisie. */
export function hasMixedEditions(groups: EditionGroup[]): boolean {
  return groups.filter((g) => g.edition !== '').length >= 2
}

/**
 * Étape 8 (modèle Tome != Ownership) : sous-ensemble RÉELLEMENT possédé (Ownership
 * active) des tomes catalogués d'une édition - un Variant catalogué sans Ownership
 * active (ex: exemplaire revendu, voir OwnershipDeletionService côté backend) n'est
 * jamais compté comme possédé ici, contrairement à group.volumeNumbers ci-dessus qui
 * ne mesure que le catalogue. Toujours utiliser CETTE fonction, jamais
 * group.volumeNumbers, pour tout ce qui affiche "possédé" ou alimente le moteur de
 * complétude (GET /purchase-analysis/completeness).
 */
export function ownedVolumeNumbers(variants: VariantDto[], ownerships: OwnershipResponse[], edition: string): number[] {
  const variantsById = new Map(variants.map((v) => [v.id, v]))
  const owned = new Set<number>()
  for (const ownership of ownerships) {
    if (ownership.status !== 'OWNED') continue
    if (!ownership.variantId) continue
    const variant = variantsById.get(ownership.variantId)
    if (!variant) continue
    const variantEdition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    if (variantEdition !== edition) continue
    const volumeNumber = variant.attributes.volumeNumber
    if (typeof volumeNumber === 'number') owned.add(volumeNumber)
  }
  return Array.from(owned).sort((a, b) => a - b)
}
