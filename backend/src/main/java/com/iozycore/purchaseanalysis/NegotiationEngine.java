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
                    "Aucun prix relevé ni prix neuf connu pour cette édition - impossible d'estimer une valeur juste.");
        }

        BigDecimal maxPrice = round(fairValue.multiply(BigDecimal.ONE.add(BAND)));
        BigDecimal targetMin = round(fairValue.multiply(BigDecimal.ONE.subtract(BAND)));
        BigDecimal targetMax = maxPrice;
        BigDecimal skipThreshold = round(maxPrice.multiply(SKIP_THRESHOLD_MULTIPLIER));

        if (askingPrice.compareTo(targetMin) <= 0) {
            return new NegotiationRecommendation(askingPrice, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.ACCEPTABLE_AS_IS,
                    "Le prix demandé est déjà au niveau de la valeur estimée, voire en dessous - inutile de négocier bas.", true);
        }
        if (askingPrice.compareTo(maxPrice) <= 0) {
            return new NegotiationRecommendation(targetMin, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.ACCEPTABLE_AS_IS,
                    "Le prix demandé se situe déjà dans une fourchette correcte pour cette annonce.", true);
        }
        if (askingPrice.compareTo(skipThreshold) <= 0) {
            return new NegotiationRecommendation(targetMin, targetMin, targetMax, maxPrice,
                    NegotiationAdvice.NEGOTIATE,
                    "Le prix demandé dépasse la valeur estimée - propose une offre proche de la fourchette juste.", true);
        }
        return NegotiationRecommendation.skip(
                "Le prix demandé (" + askingPrice + ") dépasse très largement la valeur estimée (" + fairValue
                        + ") - passer son tour est plus réaliste que négocier.");
    }

    private static BigDecimal round(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
