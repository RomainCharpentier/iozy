package com.iozycore.manga.domain.deals;

/**
 * Where a market reference comes from. Always stated, never assumed.
 *
 * <h2>Only one source produces a reference</h2>
 * The prices observed by the user. Neither the AI estimate nor the catalogue
 * new price is one: they are benchmarks that are useful elsewhere (cost
 * to complete, negotiation, overall verdict), but presenting them as
 * "the market" would give a guess the authority of a finding. The
 * distinction already existed for the price per volume ({@link PriceBasis}); it
 * now also applies to the price position.
 */
public enum MarketReferenceSource {

    /** Prices observed in IozyCore, filtered on listings that are structurally comparable. */
    OBSERVED_COMPARABLES,

    /** No reference - see {@link ReferenceGap} for what exactly is missing. */
    NONE,

    /**
     * Analysis saved before the origin was kept. We do not
     * reinvent afterwards where its number came from: we say we do not know.
     */
    NOT_RECORDED
}
