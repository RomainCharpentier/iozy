package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Produces the three-price negotiation output (recommended offer / target
 * range / max price), or an explicit "skip this listing" advice when the
 * asking price is too far above fair value - the specification explicitly
 * asks not to always recommend negotiating. Pure, no Spring/JPA/HTTP
 * dependency.
 */
public class NegotiationEngine {

    /** How far above/below fair value the target range extends - configurable in spirit, kept as a constant for Phase 1. */
    private static final BigDecimal BAND = new BigDecimal("0.05");

    /** Asking price beyond {@code maxPrice * SKIP_THRESHOLD_MULTIPLIER} is considered unrealistic to negotiate down to a fair price. */
    private static final BigDecimal SKIP_THRESHOLD_MULTIPLIER = new BigDecimal("1.25");

    /**
     * @param askingPrice the seller's asking price (excludes shipping/buyer-protection fees,
     *                    which are not part of what can be negotiated with the seller)
     * @param fairValue   the estimated fair value for exactly what is being bought - null when
     *                    neither a market observation nor a retail price allowed computing one
     */
    public NegotiationRecommendation recommend(BigDecimal askingPrice, BigDecimal fairValue) {
        if (fairValue == null) {
            return NegotiationRecommendation.unavailable(
                    "No market observation and no retail price available for this edition - a fair value cannot be estimated.");
        }

        BigDecimal maxPrice = round(fairValue.multiply(BigDecimal.ONE.add(BAND)));
        BigDecimal targetMin = round(fairValue.multiply(BigDecimal.ONE.subtract(BAND)));
        BigDecimal targetMax = maxPrice;
        BigDecimal skipThreshold = round(maxPrice.multiply(SKIP_THRESHOLD_MULTIPLIER));

        if (askingPrice.compareTo(targetMin) <= 0) {
            return new NegotiationRecommendation(askingPrice, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.ACCEPTABLE_AS_IS,
                    "Asking price is already at or below the estimated fair value - no need to lowball.", true);
        }
        if (askingPrice.compareTo(maxPrice) <= 0) {
            return new NegotiationRecommendation(targetMin, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.ACCEPTABLE_AS_IS,
                    "Asking price already sits within a fair range for this listing.", true);
        }
        if (askingPrice.compareTo(skipThreshold) <= 0) {
            return new NegotiationRecommendation(targetMin, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.NEGOTIATE,
                    "Asking price is above fair value - propose an offer close to the fair value range.", true);
        }
        return NegotiationRecommendation.unavailable(
                "Asking price (" + askingPrice + ") is far above the estimated fair value (" + fairValue
                        + ") - passing on this listing is more realistic than negotiating.");
    }

    private static BigDecimal round(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
