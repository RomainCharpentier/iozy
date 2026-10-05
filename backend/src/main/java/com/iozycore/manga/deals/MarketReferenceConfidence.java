package com.iozycore.manga.deals;

/**
 * What a market reference is worth, <b>absence included</b>.
 *
 * <h2>Why a fourth level</h2>
 * {@link ConfidenceLevel} only has HIGH/MEDIUM/LOW: the absence of a reference was
 * expressed there by a {@code null} price that had to be tested somewhere else. By
 * naming {@link #UNAVAILABLE}, the reference carries the information itself, and
 * a caller that forgets it can no longer produce a position from
 * nothing.
 *
 * <h2>The threshold that matters</h2>
 * Only HIGH and MEDIUM allow a price position. LOW says "we have
 * something, but not enough to decide": the screen shows it as
 * insufficient rather than drawing a category from data that we know is
 * fragile.
 */
public enum MarketReferenceConfidence {

    /** Several recent comparables, close to each other. */
    HIGH,

    /** Enough to place oneself, with a reservation: few comparables, or an accepted approximation. */
    MEDIUM,

    /** Too few, too scattered or too old to decide. Not used to place a price. */
    LOW,

    /** No comparable kept. There is no reference, and the screen must say so. */
    UNAVAILABLE;

    /** True when the reference can be used to place a price. The only test to do before comparing. */
    public boolean allowsPositioning() {
        return this == HIGH || this == MEDIUM;
    }

    /** Goes down one level, never below LOW: an existing reference does not become non-existent. */
    public MarketReferenceConfidence degraded() {
        return switch (this) {
            case HIGH -> MEDIUM;
            case MEDIUM, LOW -> LOW;
            case UNAVAILABLE -> UNAVAILABLE;
        };
    }

    /** Caps at a given level - used for accepted approximations (multi-series lot, badly filled edition). */
    public MarketReferenceConfidence cappedAt(MarketReferenceConfidence plafond) {
        return compareTo(plafond) < 0 ? plafond : this;
    }
}
