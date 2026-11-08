package com.iozycore.core.domain.work;

/**
 * Where the collector stands with a work: still collecting it, paused, or given up.
 *
 * <p>A paused or dropped work still lists its elements, but its missing elements
 * are no longer counted: they do not belong on the "to buy" list or in the
 * "missing" totals of the home page.
 */
public enum CollectorStatus {
    ONGOING,
    PAUSED,
    DROPPED;

    /** True when the missing elements of a work in this status are counted. */
    public boolean countsMissing() {
        return this == ONGOING;
    }
}
