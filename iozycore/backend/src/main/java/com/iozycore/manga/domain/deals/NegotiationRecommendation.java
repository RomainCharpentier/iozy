package com.iozycore.manga.domain.deals;

import java.math.BigDecimal;

/**
 * The three-price output of {@link NegotiationEngine}. When
 * {@code advice} is {@link NegotiationAdvice#SKIP_LISTING}, the three
 * prices are {@code null} - the specification explicitly asks not to
 * always recommend negotiating: an unrealistic gap is surfaced as "skip
 * this listing" instead of a made-up offer.
 *
 * @param priceDataAvailable false when neither a market observation nor a retail price allowed
 *                           computing a fair value at all - in that case every price field is
 *                           null and {@code rationale} explains why, rather than pretending an
 *                           advice was possible.
 *                           <p>
 *                           It does NOT mean "no advice": {@link #skip(String)} also nulls every
 *                           price field, but there the fair value was known and the asking price
 *                           simply blew past it. Both produce {@link NegotiationAdvice#SKIP_LISTING},
 *                           and this flag is the only thing that tells them apart - a screen that
 *                           reads the advice alone would present "je ne sais rien" as a judgement.
 */
public record NegotiationRecommendation(BigDecimal recommendedOffer, BigDecimal targetPriceMin,
                                         BigDecimal targetPriceMax, BigDecimal maxPrice, NegotiationAdvice advice,
                                         String rationale, boolean priceDataAvailable) {

    /** No fair value could be computed at all - the advice rests on an ABSENCE of data. */
    public static NegotiationRecommendation unavailable(String rationale) {
        return new NegotiationRecommendation(null, null, null, null, NegotiationAdvice.SKIP_LISTING, rationale, false);
    }

    /**
     * The fair value IS known and the asking price is unrealistically far above it. The three
     * prices stay null on purpose (see the record javadoc: an unrealistic gap is surfaced as
     * "skip", never as a made-up offer), but the price data was there - hence {@code true}.
     */
    public static NegotiationRecommendation skip(String rationale) {
        return new NegotiationRecommendation(null, null, null, null, NegotiationAdvice.SKIP_LISTING, rationale, true);
    }
}
