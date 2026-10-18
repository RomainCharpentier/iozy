import type { EditionProgressDto, VariantDto } from '@/common/types/api'
import { editionDe, numeroDe } from '@/common/lib/attributsTome'

/**
 * Building the grid of an edition: which numbers exist, and
 * in which state.
 *
 * Extracted from the old TomesGridSection (deleted) because three surfaces now
 * read it - the dense grid, the summary of the displayed edition and the
 * edition cards - and none of them must have its own idea of what an
 * owned volume is.
 */
export interface TomeTile {
  volumeNumber: number
  status: 'owned' | 'cataloguedMissing' | 'virtualMissing'
  variant?: VariantDto
}

/** Builds the visual grid of an edition: an owned volume (active Ownership)
 * is never confused with a simply cataloged one (Tome model !=
 * Ownership) nor with a purely virtual one (number deduced from totalVolumes,
 * never cataloged). Without a known totalVolumes, we only show what is
 * really known (owned or cataloged) - never a virtual tile
 * guessed without a total to rely on.
 *
 * <p>Everything comes from the SAME `groupe` (see GET /insights/progress/{entityId}):
 * owned, cataloged and total. Before, these three arrived from three
 * places - a grouping redone here, a reading of the Ownership records redone
 * here, and a call to completeness - which could contradict each other.
 *
 * <p>An existing Variant counts as "cataloged" whatever the list of
 * cataloged volumes says, since it comes from a network answer that may be old: this is what
 * makes a volume put in the wishes just now (and therefore cataloged just now, see
 * TomeResolver) carry its state at once instead of falling back to a purely
 * deduced tile, with no identity to attach the wish to. */
export function buildTiles(group: EditionProgressDto, variants: VariantDto[]): TomeTile[] {
  const owned = group.ownedVolumeNumbers
  const totalVolumes = group.totalVolumes
  const variantsByNumber = new Map<number, VariantDto>()
  // group.sourceEditions rather than group.edition alone: a merged group
  // (see resolveEditionView) must find the Variant of a volume with no
  // specified edition as well as that of the named edition.
  const sourceSet = new Set(group.sourceEditions)
  for (const variant of variants) {
    const num = numeroDe(variant)
    if (num !== null && sourceSet.has(editionDe(variant))) variantsByNumber.set(num, variant)
  }
  const ownedSet = new Set(owned)

  if (totalVolumes === null) {
    return group.cataloguedVolumeNumbers.map((n) => ({
      volumeNumber: n,
      status: ownedSet.has(n) ? ('owned' as const) : ('cataloguedMissing' as const),
      variant: variantsByNumber.get(n),
    }))
  }

  // "Cataloged but not owned" is deduced, rather than asked again from the
  // server: it is exactly the difference between the two lists of the group.
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

  // Volumes really cataloged/owned BEYOND the known total of the edition:
  // shown after the others rather than hidden. The case exists as soon as a volume is
  // added by hand with a number that is too big - hiding them made the data
  // invisible AND unrecoverable from the screen, especially since there is no longer any
  // way to renumber a volume (see USER_JOURNEYS section 20): the only recourse is
  // to delete it and add it again, provided one can see it. An edition
  // total can also be wrong: better to show the contradiction.
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
