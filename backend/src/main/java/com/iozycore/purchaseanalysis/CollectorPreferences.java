package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;

import java.util.List;
import java.util.Map;

/**
 * Configurable collector profile driving {@link VerdictScorer} and
 * {@link NegotiationEngine} - single instance in Phase 1 (the app stays
 * mono-user, same convention as {@link com.iozycore.domain.shared.DefaultOwner}).
 * {@link #defaults()} matches the default profile described in the
 * specification verbatim; every field is meant to be user-editable
 * afterwards via {@code PATCH /api/purchase-analysis/preferences}.
 */
public record CollectorPreferences(boolean preferCompletedSeries, boolean avoidOngoingSeries,
                                    boolean preferOmnibusIntegral, List<EditionTier> editionTierRanking,
                                    boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                    boolean frenchLanguageOnly, boolean preferEasyToCompleteCollections,
                                    WeightLevel conditionImportance, int minimumDiscountVsRetailPercent,
                                    Map<VerdictFactor, Integer> factorWeights) {

    /**
     * The specification's edition hierarchy, best first. Kept apart from {@link #defaults()} so
     * that a profile which simply does not rank editions can fall back on it - see
     * {@link VerdictScorer}: an empty ranking is an ABSENCE of preference, not a preference for
     * ranking nothing.
     */
    public static final List<EditionTier> SPECIFIED_EDITION_TIER_RANKING = List.of(
            EditionTier.PERFECT, EditionTier.COLLECTOR, EditionTier.PRESTIGE, EditionTier.DELUXE,
            EditionTier.INTEGRAL, EditionTier.STANDARD, EditionTier.OTHER);

    /**
     * The specification's factor weights, summing to 100. Same reason as the ranking above: a
     * profile that names no weight for a factor has not chosen to silence it, and
     * {@link VerdictScorer} falls back here rather than on zero.
     */
    public static final Map<VerdictFactor, Integer> SPECIFIED_FACTOR_WEIGHTS = Map.ofEntries(
            Map.entry(VerdictFactor.FINAL_PRICE_VS_FAIR_VALUE, 20),
            Map.entry(VerdictFactor.RETAIL_DISCOUNT, 12),
            Map.entry(VerdictFactor.REAL_MARKET_ALIGNMENT, 10),
            Map.entry(VerdictFactor.CONDITION, 15),
            Map.entry(VerdictFactor.COMPLETENESS, 12),
            Map.entry(VerdictFactor.AVAILABILITY, 8),
            Map.entry(VerdictFactor.EDITION_QUALITY, 10),
            Map.entry(VerdictFactor.COST_TO_COMPLETE, 6),
            Map.entry(VerdictFactor.NEW_EDITION_RISK, 5),
            Map.entry(VerdictFactor.RARITY, 2));

    public CollectorPreferences {
        editionTierRanking = editionTierRanking == null ? List.of() : List.copyOf(editionTierRanking);
        factorWeights = factorWeights == null ? Map.of() : Map.copyOf(factorWeights);
    }

    /**
     * Default profile straight from the specification: prefer completed
     * series and integrals, prefer premium tiers, avoid an outdated edition
     * when a better one exists or is announced, French only, prefer
     * easy-to-complete collections, high importance on condition, seek a
     * real discount vs retail, never buy purely for a low price-per-volume
     * (hence no RARITY-only or price-per-volume factor dominating the
     * default weights below).
     */
    public static CollectorPreferences defaults() {
        return new CollectorPreferences(
                true, true, true, SPECIFIED_EDITION_TIER_RANKING,
                true, true, true, WeightLevel.HIGH, 20, SPECIFIED_FACTOR_WEIGHTS);
    }
}
