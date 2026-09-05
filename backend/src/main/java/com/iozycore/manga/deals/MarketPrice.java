package com.iozycore.manga.deals;

import java.math.BigDecimal;
import com.iozycore.core.insights.ConfidenceLevel;

/**
 * Price information for one item, always keeping observed, AI-estimated and
 * theoretical figures in separate fields - {@code observedMedian}/
 * {@code observedLow}/{@code observedHigh} stay {@code null} whenever
 * {@code observationCount} is 0, no matter how confident the AI or
 * theoretical estimate is. This is the central guardrail against "never
 * invent a market value in the absence of data" (Phase 1) and "never
 * conflate an AI estimate with a real observation" (Phase 2, project
 * memory): nothing downstream may fall back onto the theoretical or
 * AI-estimated figure under the observed fields' names.
 */
public record MarketPrice(int observationCount, BigDecimal observedMedian, BigDecimal observedLow,
                           BigDecimal observedHigh, BigDecimal theoreticalEstimate, PriceBasis basis,
                           ConfidenceLevel confidence, BigDecimal aiEstimatedPrice) {
    public MarketPrice {
        if (observationCount == 0 && (observedMedian != null || observedLow != null || observedHigh != null)) {
            throw new IllegalArgumentException("Observed price fields must be null when observationCount is 0");
        }
        if (observationCount > 0 && observedMedian == null) {
            throw new IllegalArgumentException("observedMedian is required when observationCount > 0");
        }
        if (basis == PriceBasis.AI_ESTIMATED && aiEstimatedPrice == null) {
            throw new IllegalArgumentException("aiEstimatedPrice is required when basis is AI_ESTIMATED");
        }
    }

    public static MarketPrice noObservations(BigDecimal theoreticalEstimate, ConfidenceLevel confidence) {
        return new MarketPrice(0, null, null, null, theoreticalEstimate, PriceBasis.THEORETICAL_ONLY, confidence, null);
    }

    /** Phase 2 (assistance IA) - used only when no real observation exists, see {@link AiMarketPriceAdvisor}. */
    public static MarketPrice aiEstimated(BigDecimal aiEstimatedPrice, BigDecimal theoreticalEstimate, ConfidenceLevel confidence) {
        return new MarketPrice(0, null, null, null, theoreticalEstimate, PriceBasis.AI_ESTIMATED, confidence, aiEstimatedPrice);
    }

    public static MarketPrice fromObservations(int observationCount, BigDecimal median, BigDecimal low,
                                                BigDecimal high, BigDecimal theoreticalEstimate,
                                                ConfidenceLevel confidence) {
        return new MarketPrice(observationCount, median, low, high, theoreticalEstimate,
                PriceBasis.OBSERVED_MARKET, confidence, null);
    }

    /** The best price figure available for this item - real observation first, then an AI estimate, then the generic theoretical fallback (may still be null). */
    public BigDecimal bestEstimate() {
        return switch (basis) {
            case OBSERVED_MARKET -> observedMedian;
            case AI_ESTIMATED -> aiEstimatedPrice;
            case THEORETICAL_ONLY -> theoreticalEstimate;
        };
    }
}
