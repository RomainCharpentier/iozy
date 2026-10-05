package com.iozycore.manga.deals;

/**
 * What is missing for a market reference to exist.
 *
 * <h2>Say what to do, not only that we do not know</h2>
 * "Reference not sufficient" leaves the user with nothing to act on. "3 prices observed
 * on this edition, but none on a lot of comparable size" tells them
 * exactly which observation to add so that the next analysis can decide. This is
 * the difference between an honest screen and a silent screen.
 */
public enum ReferenceGap {

    /** Nothing is missing: the reference exists. */
    NONE,

    /** The edition is not in the catalogue yet - no observation can be linked to it. */
    EDITION_NOT_IN_CATALOGUE,

    /** No price observed on this edition. */
    NO_OBSERVATION,

    /**
     * Observations exist, but none is about a comparable product -
     * single volume against lot, or lots of sizes too far apart. The most
     * important case: it is exactly the one where the old average made up a
     * price.
     */
    NO_COMPARABLE_SHAPE,

    /** Comparables existed, but all too old to describe today's market. */
    ONLY_STALE_OBSERVATIONS,

    /**
     * The only comparable observation comes from <b>this very listing</b>, noted during
     * a previous analysis. It is excluded from its own reference - otherwise
     * any listing that is analysed again would say "at market price", its own. So
     * another offer is missing, not another observation of this one.
     */
    ONLY_CURRENT_LISTING,

    /** Multi-series lot where at least one series has no reference: the sum would be truncated, so misleading. */
    INCOMPLETE_LOT_COVERAGE,

    /** Analysis older than the recording of this information. */
    NOT_RECORDED
}
