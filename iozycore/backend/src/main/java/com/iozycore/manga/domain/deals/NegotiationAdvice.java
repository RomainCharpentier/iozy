package com.iozycore.manga.domain.deals;

/** Outcome of {@link NegotiationEngine} - whether to negotiate, accept as-is, or skip the listing entirely. */
public enum NegotiationAdvice {
    NEGOTIATE,
    ACCEPTABLE_AS_IS,
    /** The asking price is too far from fair value - recommending an offer would be unrealistic. */
    SKIP_LISTING
}
