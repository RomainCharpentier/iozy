package com.iozycore.manga.domain.deals;

/**
 * The <b>shape</b> of a lot: what it is structurally, before any price.
 *
 * <h2>Why this notion exists</h2>
 * A single volume, a partial lot and a complete set are not the same product,
 * even with the same series and the same edition. The second-hand market values them
 * differently <b>per volume</b>: an odd volume sells close to new,
 * a complete set sells cheap because it needs a single buyer and a big
 * parcel. Reducing the three to a "price per volume" and then taking the median
 * produces a precise and wrong number.
 *
 * <h2>What it does not claim to be</h2>
 * It is not a taxonomy of manga, it is the minimum that prevents
 * comparing two different products: how many volumes, and does it
 * cover the whole edition.
 */
public enum LotShape {

    /** A single volume. The price per volume is the highest of the market there. */
    SINGLE_VOLUME,

    /** Several volumes without covering the edition. Size still counts, hence the tolerance band of the selector. */
    PARTIAL_LOT,

    /** All the volumes of the edition. A product on its own, with its own discount. */
    COMPLETE_SET,

    /**
     * Impossible to place - typically an observation "on the whole edition"
     * while the number of volumes of this edition is not filled in. We do not
     * guess: such an observation is dropped from the comparables.
     */
    INDETERMINATE;

    /**
     * @param volumeCount          number of volumes concerned, {@code 0} or less if unknown
     * @param editionTotalVolumes  total number of volumes of the edition, {@code null} if not filled in -
     *                             without it, we cannot tell a complete set from a partial lot,
     *                             and the lot is treated as partial rather than promoted to complete set
     */
    public static LotShape of(int volumeCount, Integer editionTotalVolumes) {
        if (volumeCount <= 0) {
            return INDETERMINATE;
        }
        if (volumeCount == 1) {
            return SINGLE_VOLUME;
        }
        if (editionTotalVolumes != null && editionTotalVolumes > 0 && volumeCount >= editionTotalVolumes) {
            return COMPLETE_SET;
        }
        return PARTIAL_LOT;
    }

    /** True when the shape allows looking for comparables. */
    public boolean isComparable() {
        return this != INDETERMINATE;
    }
}
