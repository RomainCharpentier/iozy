package com.iozycore.manga.deals;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The business thresholds of the assessment, gathered in one place.
 *
 * They live here rather than spread in the calculations so that they can be
 * read, discussed and tested without reading the engine. The values are
 * specific to IozyCore and to the second-hand manga market: they were not
 * taken from elsewhere, where they would describe another market.
 *
 * A market reference is only used if its confidence is high enough -
 * comparing with a median taken from two doubtful listings produces a
 * precise and wrong number, which is worse than "reference not sufficient".
 */
public final class DealAssessmentPolicy {

    private DealAssessmentPolicy() {
    }

    /** Fractions of the reference that set the limits of the price categories. */
    private static final BigDecimal TRES_BON = new BigDecimal("0.70");
    private static final BigDecimal BON = new BigDecimal("0.85");
    private static final BigDecimal CORRECT = new BigDecimal("1.10");
    private static final BigDecimal PLUTOT_CHER = new BigDecimal("1.35");

    /**
     * Places the <b>listing price</b> - without fees, like the listings
     * it is compared to. Never pass it the acquisition cost:
     * the comparables are without fees, and mixing the two bases reverses the
     * verdict (see {@code PriceSemanticsTest}).
     * <p>
     * Returns {@link PricePosition#REFERENCE_UNAVAILABLE} as soon as the reference
     * cannot be used - a single question to ask, carried by the
     * reference itself.
     */
    public static PricePosition positionOf(BigDecimal askingPrice, MarketReference reference) {
        if (reference == null || !reference.isUsable()) {
            return PricePosition.REFERENCE_UNAVAILABLE;
        }
        return positionOf(askingPrice, reference.price(), reference.confidence());
    }

    /**
     * Places a price. Returns {@link PricePosition#REFERENCE_UNAVAILABLE} as soon as
     * the reference is missing or not reliable enough - never a category taken
     * from data that we know is fragile.
     */
    public static PricePosition positionOf(BigDecimal askingPrice, BigDecimal reference,
                                            MarketReferenceConfidence confidence) {
        if (askingPrice == null || reference == null || reference.signum() <= 0
                || confidence == null || !confidence.allowsPositioning()) {
            return PricePosition.REFERENCE_UNAVAILABLE;
        }
        BigDecimal ratio = askingPrice.divide(reference, 4, RoundingMode.HALF_UP);
        if (ratio.compareTo(TRES_BON) < 0) return PricePosition.VERY_GOOD_PRICE;
        if (ratio.compareTo(BON) < 0) return PricePosition.GOOD_PRICE;
        if (ratio.compareTo(CORRECT) <= 0) return PricePosition.FAIR_PRICE;
        if (ratio.compareTo(PLUTOT_CHER) <= 0) return PricePosition.RATHER_EXPENSIVE;
        return PricePosition.TOO_EXPENSIVE;
    }

    /** The gap to the reference, as a signed percentage - half of the explanation is in this number. */
    public static Integer deviationPercent(BigDecimal askingPrice, BigDecimal reference) {
        if (askingPrice == null || reference == null || reference.signum() <= 0) {
            return null;
        }
        return askingPrice.subtract(reference)
                .multiply(BigDecimal.valueOf(100))
                .divide(reference, 0, RoundingMode.HALF_UP)
                .intValue();
    }
}
