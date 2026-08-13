package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;

/**
 * An LLM's best-effort estimate of the current second-hand per-volume
 * market price for one edition in one {@link Condition}, used only when no
 * real {@link MarketPriceObservation} exists yet (see
 * {@link AiMarketPriceAdvisor}). Deliberately mirrors {@link EditionSuggestion}'s
 * shape - a mandatory {@code confidence} and {@code rationale}, never a raw
 * AI-sourced figure without a stated trust level.
 */
public record AiPriceEstimate(BigDecimal pricePerVolume, ConfidenceLevel confidence, String rationale) {
}
