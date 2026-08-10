package com.iozycore.purchaseanalysis;

/**
 * Distinguishes a price grounded in real data from a computed fallback -
 * this distinction must be preserved end-to-end (domain, API, UI) per the
 * hard constraint: never present an estimated value as certain, and never
 * invent a market value in the absence of data.
 */
public enum PriceBasis {
    /** Backed by at least one real {@link MarketPriceObservation}. */
    OBSERVED_MARKET,
    /** Computed from retail price and a generic condition-based discount - no real market data available. */
    THEORETICAL_ONLY
}
