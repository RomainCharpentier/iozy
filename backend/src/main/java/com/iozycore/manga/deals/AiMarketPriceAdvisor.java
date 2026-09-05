package com.iozycore.manga.deals;

import java.util.Optional;

/**
 * Port for an LLM-backed best-effort estimate of an edition's current
 * second-hand market price, used by {@link PurchaseAnalysisService#analyze}
 * only when no real {@link MarketPriceObservation} exists yet for that
 * edition - real data always takes priority, this is a fallback on top of
 * the existing generic theoretical estimate, never a replacement for it.
 * Same self-disabling contract as {@link AiEditionAdvisor} and every other
 * external metadata provider in this codebase: no configured key means an
 * always-empty result, never an exception surfacing to the caller.
 * <p>
 * Guardrail (approved direction, see project memory): the result is
 * informational only, feeding {@link MarketPrice}'s dedicated
 * {@link PriceBasis#AI_ESTIMATED} basis so it stays visually and
 * structurally distinct from a real {@link PriceBasis#OBSERVED_MARKET}
 * price everywhere it is displayed - implementations must never write to
 * {@link MarketPriceObservationRepository} themselves.
 */
public interface AiMarketPriceAdvisor {

    /** Empty when no AI provider is configured, or it could not produce a usable answer - never throws. */
    Optional<AiPriceEstimate> estimateMarketPrice(String seriesTitle, String editionName, Condition condition);
}
