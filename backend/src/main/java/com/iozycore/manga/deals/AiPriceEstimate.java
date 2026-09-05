package com.iozycore.manga.deals;

import java.math.BigDecimal;
import com.iozycore.core.insights.ConfidenceLevel;

/**
 * An LLM's best-effort estimate of the current second-hand per-volume
 * market price for one edition in one {@link Condition}, used only when no
 * real {@link MarketPriceObservation} exists yet (see
 * {@link AiMarketPriceAdvisor}). Deliberately mirrors {@link EditionSuggestion}'s
 * shape - a mandatory {@code confidence} and {@code rationale}, never a raw
 * AI-sourced figure without a stated trust level.
 *
 * <h2>{@code pricePerVolume} peut etre nul, et ce n'est pas une absence</h2>
 * C'est le modele qui repond « je ne sais pas » - ce que l'invite lui demande
 * explicitement de faire plutot que d'inventer un chiffre plausible. Une
 * REPONSE, donc, et la plus stable qui soit : elle se memorise
 * ({@link AiPriceEstimateCacheRepository}) au lieu d'etre rachetee a chaque
 * analyse. A distinguer d'un {@code Optional.empty()} rendu par
 * {@link AiMarketPriceAdvisor}, qui veut dire « pas de reponse » - cle absente,
 * quota depasse, reseau coupe - et qui, lui, ne se memorise jamais.
 */
public record AiPriceEstimate(BigDecimal pricePerVolume, ConfidenceLevel confidence, String rationale) {
}
