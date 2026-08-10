import type { VariantDto } from '../types/api'

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
