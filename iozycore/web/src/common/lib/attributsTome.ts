import type { VariantDto } from '@/common/types/api'

/**
 * What we read on a volume, and how.
 *
 * <h2>Why a module for two lines</h2>
 * The attributes of a Variant are an untyped bag (see useBrouillonInspecteur):
 * each reader must therefore decide for itself what it accepts. There were
 * four of them rewriting the same expression for the edition, and four for the
 * number - with rules that had already diverged: the assistant accepted a
 * number written as TEXT (`"12"`), the grid did not. A volume entered that way
 * would have been counted on one side and invisible on the other.
 *
 * <p>One single rule, here, and the deliberate differences (the
 * case-insensitive comparison of the cover backfill) become visible on the
 * calling line instead of being buried in a copy that looks like the others.
 */

/**
 * The edition name of a volume, as it is used as a KEY: trimmed at the
 * ends, `''` when none is given.
 *
 * <p>The case is kept: this is the name that is displayed, and it is the one
 * the server returns in `sourceEditions` (see CollectionProgressService). A
 * caller that compares with an EXTERNAL source - where "Kana" and "KANA" mean
 * the same edition - lowers the case itself, explicitly.
 */
export function editionDe(variant: Pick<VariantDto, 'attributes'>): string {
  return typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
}

/**
 * The number of a volume, or `null` if it has no usable one.
 *
 * <p>STRICT `typeof === 'number'`, like everywhere else in the app (see
 * `lib/seriesInfo.totalVolumesFrom` and the CLES_NUMERIQUES of
 * useBrouillonInspecteur, which keep the type on write precisely for this).
 * Accepting `"12"` here would mean tolerating data that the writers forbid
 * themselves to produce, and making two screens diverge on the same volume.
 */
export function numeroDe(variant: Pick<VariantDto, 'attributes'>): number | null {
  return typeof variant.attributes.volumeNumber === 'number' ? variant.attributes.volumeNumber : null
}

/** "Tome 12" if a number is usable, otherwise the raw label - same rule as
 *  the subtitle of a tile in Ma collection, kept consistent here. */
export function variantLabel(variant: VariantDto): string {
  const numero = numeroDe(variant)
  return numero !== null ? `Tome ${numero}` : variant.label
}
