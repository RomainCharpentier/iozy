package com.iozycore.manga.deals;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.iozycore.insights.ConfidenceLevel;

/**
 * The full, immutable result of analyzing one listing - produced by
 * {@link PurchaseAnalysisEngine} and persisted as-is (see
 * PurchaseAnalysisJpaEntity's JSONB payload) for the "Compare listings"
 * history view.
 *
 * @param discountPercent   null when a retail price is missing for at least one item in the lot
 * @param overallConfidence derived from how many of the ten {@link VerdictFactor}s could actually
 *                          be scored (see {@link VerdictScorer}) - surfaced to the user alongside
 *                          the verdict so a low-data analysis never reads as authoritative
 * @param totalMaxWorthwhilePrice "Analyse d'un lot" (brainstorm) - sum of each item's
 *                                {@link DuplicateAnalysis#maxWorthwhilePrice()}, i.e. up to what price
 *                                this lot stays worth it once already-owned duplicate volumes are
 *                                excluded. Null unless every item with at least one useful (non-duplicate)
 *                                volume has a known per-volume price - never a partial sum presented as
 *                                complete. Purely advisory: never factored into {@link #negotiation()} or
 *                                {@link #verdict()}, whose arithmetic stays exactly as validated against the
 *                                specification's worked examples.
 */
public record PurchaseAnalysis(UUID id, Instant requestedAt, Listing listing, List<ItemAnalysis> itemBreakdown,
                                BigDecimal totalRealCost, BigDecimal totalNewValue, BigDecimal totalSavingsAmount,
                                BigDecimal discountPercent, NegotiationRecommendation negotiation, Verdict verdict,
                                int verdictScore, Map<VerdictFactor, FactorScore> factorBreakdown,
                                List<Warning> warnings, ConfidenceLevel overallConfidence,
                                BigDecimal totalMaxWorthwhilePrice, ListingAssessment assessment) {
    public PurchaseAnalysis {
        itemBreakdown = itemBreakdown == null ? List.of() : List.copyOf(itemBreakdown);
        factorBreakdown = factorBreakdown == null ? Map.of() : Map.copyOf(factorBreakdown);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }
}
