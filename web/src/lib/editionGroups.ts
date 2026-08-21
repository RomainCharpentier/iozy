import type { OwnershipResponse, VariantDto } from '../types/api'

export interface EditionGroup {
  /** "" = tomes sans édition précisée (jamais compté comme une édition distincte, voir groupVariantsByEdition). */
  edition: string
  volumeNumbers: number[]
  /** Valeur(s) brute(s) de l'attribut "edition" des Variant inclus dans ce
   * groupe - normalement [edition], mais peut aussi inclure "" en plus quand
   * ce groupe résulte d'une fusion (voir resolveEditionView). Sert à
   * retrouver le bon Variant/Ownership même si son attribut brut diffère du
   * libellé affiché (ex: un tome ajouté à la main sans taper l'édition, mais
   * rattaché visuellement à l'unique édition nommée de la série). */
  sourceEditions: string[]
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
    .map(([edition, volumeNumbers]) => ({
      edition,
      volumeNumbers: volumeNumbers.sort((a, b) => a - b),
      sourceEditions: [edition],
    }))
    .sort((a, b) => b.volumeNumbers.length - a.volumeNumbers.length)
}

/** true seulement s'il existe 2+ éditions NOMMÉES distinctes - le groupe ""
 * (tomes sans édition précisée) ne compte jamais comme une édition en soi,
 * pour ne pas signaler à tort un mélange sur une simple absence de saisie. */
export function hasMixedEditions(groups: EditionGroup[]): boolean {
  return groups.filter((g) => g.edition !== '').length >= 2
}

/**
 * Vue à afficher pour la fiche série (voir TomesGridSection, audit UX "fiche
 * série trop technique") : une seule édition NOMMÉE plus quelques tomes sans
 * édition précisée ne fait pas 2 éditions à choisir - le plus souvent un
 * tome ajouté à la main sans retaper le nom déjà connu (voir
 * AddVolumeSection), pas une seconde édition réelle. Les fusionner en un
 * seul groupe affiché évite le rendu "champs techniques bruts" ("Kana" /
 * "Sans édition précisée" / "18" côte à côte) au profit d'un "Kana" unique
 * couvrant tous les tomes connus de la série.
 * <p>
 * Dès qu'il existe 2+ éditions NOMMÉES (voir hasMixedEditions), l'ambiguïté
 * est réelle - à laquelle des deux rattacher un tome sans édition précisée ?
 * - rien n'est fusionné dans ce cas : chaque groupe, "" compris, reste
 * sélectionnable séparément plutôt que de deviner.
 */
export function resolveEditionView(groups: EditionGroup[]): EditionGroup[] {
  const named = groups.filter((g) => g.edition !== '')
  const blank = groups.find((g) => g.edition === '')
  if (named.length !== 1 || !blank) return groups
  const merged = Array.from(new Set([...named[0].volumeNumbers, ...blank.volumeNumbers])).sort((a, b) => a - b)
  return [{ edition: named[0].edition, volumeNumbers: merged, sourceEditions: [named[0].edition, ''] }]
}

/**
 * Étape 8 (modèle Tome != Ownership) : sous-ensemble RÉELLEMENT possédé (Ownership
 * active) des tomes catalogués d'une édition - un Variant catalogué sans Ownership
 * active (ex: exemplaire revendu, voir OwnershipDeletionService côté backend) n'est
 * jamais compté comme possédé ici, contrairement à group.volumeNumbers ci-dessus qui
 * ne mesure que le catalogue. Toujours utiliser CETTE fonction, jamais
 * group.volumeNumbers, pour tout ce qui affiche "possédé" ou alimente le moteur de
 * complétude (GET /purchase-analysis/completeness).
 * <p>
 * `sourceEditions` (voir EditionGroup) plutôt qu'une édition unique : un groupe issu
 * d'une fusion (voir resolveEditionView) doit reconnaître un Variant possédé sous
 * N'IMPORTE LAQUELLE de ses éditions sources, pas seulement celle affichée.
 */
export function ownedVolumeNumbers(variants: VariantDto[], ownerships: OwnershipResponse[], sourceEditions: string[]): number[] {
  const variantsById = new Map(variants.map((v) => [v.id, v]))
  const editionSet = new Set(sourceEditions)
  const owned = new Set<number>()
  for (const ownership of ownerships) {
    if (ownership.status !== 'OWNED') continue
    if (!ownership.variantId) continue
    const variant = variantsById.get(ownership.variantId)
    if (!variant) continue
    const variantEdition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    if (!editionSet.has(variantEdition)) continue
    const volumeNumber = variant.attributes.volumeNumber
    if (typeof volumeNumber === 'number') owned.add(volumeNumber)
  }
  return Array.from(owned).sort((a, b) => a - b)
}

/** "Tome 12" si un numéro de tome est exploitable, sinon le label brut -
 * même règle que ShelfPage.variantSubtitle, gardée cohérente ici. */
export function variantLabel(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}
