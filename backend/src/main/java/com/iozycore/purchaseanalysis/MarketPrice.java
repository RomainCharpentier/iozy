package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;

/**
 * Price information for one item, always keeping observed and theoretical
 * figures in separate fields - {@code observedMedian}/{@code observedLow}/
 * {@code observedHigh} stay {@code null} whenever {@code observationCount}
 * is 0, no matter how confident the theoretical estimate is. This is the
 * central guardrail against "never invent a market value in the absence
 * of data": nothing downstream may fall back onto the theoretical figure
 * under the observed fields' names.
 */
public record MarketPrice(int observationCount, BigDecimal observedMedian, BigDecimal observedLow,
                           BigDecimal observedHigh, BigDecimal theoreticalEstimate, PriceBasis basis,
                           ConfidenceLevel confidence) {
    public MarketPrice {
        if (observationCount == 0 && (observedMedian != null || observedLow != null || observedHigh != null)) {
            throw new IllegalArgumentException("Observed price fields must be null when observationCount is 0");
        }
        if (observationCount > 0 && observedMedian == null) {
            throw new IllegalArgumentException("observedMedian is required when observationCount > 0");
        }
    }

    public static MarketPrice noObservations(BigDecimal theoreticalEstimate, ConfidenceLevel confidence) {
        return new MarketPrice(0, null, null, null, theoreticalEstimate, PriceBasis.THEORETICAL_ONLY, confidence);
    }

    public static MarketPrice fromObservations(int observationCount, BigDecimal median, BigDecimal low,
                                                BigDecimal high, BigDecimal theoreticalEstimate,
                                                ConfidenceLevel confidence) {
        return new MarketPrice(observationCount, median, low, high, theoreticalEstimate,
                PriceBasis.OBSERVED_MARKET, confidence);
    }

    /** The best price figure available for this item - observed median when there is real data, theoretical otherwise (may still be null). */
    public BigDecimal bestEstimate() {
        return basis == PriceBasis.OBSERVED_MARKET ? observedMedian : theoreticalEstimate;
    }
}
