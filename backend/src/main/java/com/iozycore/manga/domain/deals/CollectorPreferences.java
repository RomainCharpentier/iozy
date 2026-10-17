package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.EditionTier;

import java.util.List;
import java.util.Map;

/**
 * Configurable collector profile driving {@link VerdictScorer} and
 * {@link NegotiationEngine} - single instance in Phase 1 (the app stays
 * mono-user, same convention as {@link com.iozycore.core.domain.shared.DefaultOwner}).
 * {@link #defaults()} matches the default profile described in the
 * specification verbatim; every field is meant to be user-editable
 * afterwards via {@code PATCH /api/purchase-analysis/preferences}.
 *
 * <h2>Cinq preferences retirees (Lot 84)</h2>
 * {@code preferCompletedSeries}, {@code avoidOngoingSeries},
 * {@code preferOmnibusIntegral}, {@code frenchLanguageOnly} et
 * {@code preferEasyToCompleteCollections} vivaient ici depuis la Phase 1 sans
 * qu'AUCUNE ligne du moteur ne les lise - constate par comptage au Lot 73, et
 * deja ce qui avait fait abandonner l'ecran de reglages au Lot 30. Elles
 * etaient pourtant persistees, validees par l'API et rendues par
 * {@code GET /preferences} : une surface de configuration qui promettait cinq
 * leviers inertes.
 * <p>
 * Decision de l'utilisateur (2026-08-29) : les retirer plutot que d'inventer
 * cinq regles de score qui n'existaient nulle part. Ce qui reste ici est
 * exactement ce que le moteur lit.
 */
public record CollectorPreferences(List<EditionTier> editionTierRanking,
                                    boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
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
     * Default profile straight from the specification, reduit a ce que le moteur
     * lit reellement : preferer les gammes premium, eviter une edition depassee
     * quand une meilleure existe ou est annoncee, forte importance de l'etat,
     * chercher une vraie decote vis-a-vis du neuf, et ne jamais acheter pour le
     * seul prix au tome (d'ou l'absence de facteur RARITY dominant ci-dessous).
     */
    public static CollectorPreferences defaults() {
        return new CollectorPreferences(SPECIFIED_EDITION_TIER_RANKING, true,
                WeightLevel.HIGH, 20, SPECIFIED_FACTOR_WEIGHTS);
    }
}
