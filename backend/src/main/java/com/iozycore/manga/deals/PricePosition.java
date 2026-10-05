package com.iozycore.manga.deals;

/**
 * Where the asking price stands relative to a market reference.
 *
 * Named categories rather than a score: "very good price" can be discussed and
 * explained ("35 % under a reference drawn from 7 observations"), "82/100" cannot be
 * discussed. It is also what allows us to honestly say
 * REFERENCE_UNAVAILABLE when there is nothing solid to compare, instead of
 * producing a reassuring number drawn from two doubtful observations.
 *
 * A VERY low price stays a very good price here: the vigilance it calls for is
 * another dimension (see ListingTrustAssessment), and crushing it onto this one
 * would make a real bargain look like a defect.
 */
public enum PricePosition {
    VERY_GOOD_PRICE,
    GOOD_PRICE,
    FAIR_PRICE,
    RATHER_EXPENSIVE,
    TOO_EXPENSIVE,
    /** No reference reliable enough: we do not judge. */
    REFERENCE_UNAVAILABLE
}
