package com.iozycore.manga.deals;

/**
 * Where an observed price comes from: a deliberate entry, or a listing that
 * the user really analysed.
 *
 * <h2>Why tell them apart</h2>
 * Both are confirmed facts and are worth the same as
 * comparables. But they are not read the same way: a manual observation is an
 * intention ("I saw this price, I note it"), an observation coming from an analysis is a
 * by-product of another action. When a number is surprising, knowing which of the
 * two we are looking at is the first question we ask - and without this field,
 * it has no answer.
 *
 * <h2>What it is not</h2>
 * Neither a hierarchy of reliability, nor a confidence level: confidence is
 * computed on the sample ({@link MarketReferenceConfidence}), not on the
 * way the row arrived in the database.
 */
public enum MarketObservationOrigin {

    /** Entered by the user from the page of an edition. */
    MANUAL_ENTRY,

    /**
     * Kept from an analysed then saved listing. The price is that of the
     * listing, <b>without fees</b> - protection and shipping belong to the
     * buyer's acquisition cost, not to what the product is worth.
     */
    LISTING_ANALYSIS
}
