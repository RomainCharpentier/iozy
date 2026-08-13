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
    /**
     * An LLM's best-effort estimate of the current second-hand market price
     * (Phase 2, project memory) - used only when no real observation exists
     * yet, deliberately kept as its own basis rather than folded into
     * {@link #OBSERVED_MARKET} (mandatory guardrail: never conflate an AI
     * estimate with a real observation) or {@link #THEORETICAL_ONLY} (it is
     * meant to reflect real-world market knowledge, not the generic
     * condition-discount formula).
     */
    AI_ESTIMATED,
    /** Computed from retail price and a generic condition-based discount - no real market data available. */
    THEORETICAL_ONLY
}
