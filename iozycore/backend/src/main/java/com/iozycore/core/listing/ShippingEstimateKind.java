package com.iozycore.core.listing;

/**
 * What the shipping amount retained for a listing is really worth.
 * <p>
 * Without this distinction, "2.83 EUR" and "from 2.83 EUR" look alike
 * in a {@code BigDecimal} and get confused on screen - whereas the first
 * is a cost, and the second a floor. The total that follows is not
 * "the real cost" but "the estimated minimum cost", and the user must
 * be able to read it that way before deciding.
 *
 * <h2>A single dimension, deliberately</h2>
 * We could separate "how much" (amount), "what precision" (firm,
 * floor, estimate) and "where it comes from" (source, user). In practice
 * the origin only determines the precision - a manual entry is
 * an estimate, a rate read from a single source is firm - and a
 * second dimension would only bring empty combinations to freeze in the
 * JSONB of the analyses. This enumeration therefore says <b>what the amount is worth</b>,
 * which is what the screen and the computation really need.
 *
 * <h2>Frozen with the analysis</h2>
 * The semantics are kept with the saved analysis: a shipping noted
 * "from" or "estimated" at the time of the analysis must never be
 * read later as a firm rate.
 */
public enum ShippingEstimateKind {

    /** Shipping announced as free: zero, and it is a real zero. */
    FREE,

    /**
     * A single shipping mode exposed by the source: the amount is the one that
     * will be charged, as far as one can say so before payment.
     * <b>Reserved for the cases where the source really allows this statement</b> -
     * never assigned by default to a number we simply received.
     */
    EXACT,

    /**
     * Several modes exist and the source displays the cheapest. The amount
     * is a <b>floor</b>: the real one depends on the chosen pickup point.
     */
    FROM,

    /**
     * Usable but not guaranteed amount - typically typed by
     * the user. It counts in the acquisition cost (ignoring it would understate
     * the purchase), but the screen must not present it as an observed rate,
     * and above all never as a shipping "not provided": the user
     * has precisely just provided it.
     */
    ESTIMATED,

    /**
     * No usable amount. Above all do not assume zero: the cost that
     * follows is <b>incomplete</b>, and must be read as such. An
     * {@code UNKNOWN} never carries an amount entering a computation.
     */
    UNKNOWN;

    /** True when the total that follows is a minimum, not a firm amount. */
    public boolean isLowerBound() {
        return this == FROM;
    }

    /** True when a usable amount exists (zero included) and therefore enters the cost. */
    public boolean hasAmount() {
        return this != UNKNOWN;
    }

    /** True when the amount is usable without being guaranteed: to be said, never hidden. */
    public boolean isEstimate() {
        return this == ESTIMATED;
    }
}
