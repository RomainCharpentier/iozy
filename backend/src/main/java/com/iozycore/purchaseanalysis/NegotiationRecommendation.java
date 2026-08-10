package com.iozycore.purchaseanalysis;

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
 */
public record NegotiationRecommendation(BigDecimal recommendedOffer, BigDecimal targetPriceMin,
                                         BigDecimal targetPriceMax, BigDecimal maxPrice, NegotiationAdvice advice,
                                         String rationale, boolean priceDataAvailable) {

    public static NegotiationRecommendation unavailable(String rationale) {
        return new NegotiationRecommendation(null, null, null, null, NegotiationAdvice.SKIP_LISTING, rationale, false);
    }
}
