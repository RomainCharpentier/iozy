package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Weighs the ten {@link VerdictFactor}s into a single {@link Verdict}.
 * Pure, no Spring/JPA/HTTP dependency, deliberately NOT a black-box model:
 * every factor score carries a human-readable rationale and a confidence
 * level (see {@link FactorScore}), and a factor with no usable data is
 * excluded from the weighted average rather than defaulted to a neutral
 * value - its weight is removed from the denominator instead.
 */
public class VerdictScorer {

    private static final int EXCELLENT_THRESHOLD = 85;
    private static final int GOOD_THRESHOLD = 70;
    private static final int FAIR_THRESHOLD = 50;
    private static final int EXPENSIVE_THRESHOLD = 30;

    /** Everything the scorer needs, already computed by {@link PurchaseAnalysisEngine} - kept framework-free. */
    public record Input(BigDecimal totalRealCost, BigDecimal totalFairValue, BigDecimal totalNewValue,
                         BigDecimal discountPercent, boolean anyObservedMarketData, Condition listingCondition,
                         boolean conditionAppliesToContainer, List<CollectionStatus> completenessStatuses,
                         boolean anyEditionMatched, boolean anyOutOfPrint, List<EditionTier> itemTiers,
                         boolean costToCompleteKnown, BigDecimal totalCostToComplete,
                         boolean anyBetterEditionAnnounced, NegotiationAdvice negotiationAdvice,
                         boolean negotiationPriceDataAvailable) {

        /**
         * Historical shape, kept so the existing call sites need no change: it assumes the
         * negotiation advice REST ON price data, which is what {@code SKIP_LISTING} meant before
         * {@link NegotiationRecommendation#skip(String)} split the two.
         */
        public Input(BigDecimal totalRealCost, BigDecimal totalFairValue, BigDecimal totalNewValue,
                     BigDecimal discountPercent, boolean anyObservedMarketData, Condition listingCondition,
                     boolean conditionAppliesToContainer, List<CollectionStatus> completenessStatuses,
                     boolean anyEditionMatched, boolean anyOutOfPrint, List<EditionTier> itemTiers,
                     boolean costToCompleteKnown, BigDecimal totalCostToComplete,
                     boolean anyBetterEditionAnnounced, NegotiationAdvice negotiationAdvice) {
            this(totalRealCost, totalFairValue, totalNewValue, discountPercent, anyObservedMarketData,
                    listingCondition, conditionAppliesToContainer, completenessStatuses, anyEditionMatched,
                    anyOutOfPrint, itemTiers, costToCompleteKnown, totalCostToComplete, anyBetterEditionAnnounced,
                    negotiationAdvice, true);
        }
    }

    public record Outcome(Verdict verdict, int score, Map<VerdictFactor, FactorScore> factorBreakdown,
                           ConfidenceLevel overallConfidence) {
    }

    public Outcome score(Input input, CollectorPreferences preferences) {
        Map<VerdictFactor, FactorScore> factors = new EnumMap<>(VerdictFactor.class);

        putIfPresent(factors, VerdictFactor.FINAL_PRICE_VS_FAIR_VALUE, scoreFinalPriceVsFairValue(input));
        putIfPresent(factors, VerdictFactor.RETAIL_DISCOUNT, scoreRetailDiscount(input, preferences));
        factors.put(VerdictFactor.REAL_MARKET_ALIGNMENT, scoreRealMarketAlignment(input));
        factors.put(VerdictFactor.CONDITION, scoreCondition(input));
        putIfPresent(factors, VerdictFactor.COMPLETENESS, scoreCompleteness(input));
        putIfPresent(factors, VerdictFactor.AVAILABILITY, scoreAvailability(input, preferences));
        putIfPresent(factors, VerdictFactor.EDITION_QUALITY, scoreEditionQuality(input, preferences));
        putIfPresent(factors, VerdictFactor.COST_TO_COMPLETE, scoreCostToComplete(input));
        putIfPresent(factors, VerdictFactor.NEW_EDITION_RISK, scoreNewEditionRisk(input, preferences));
        putIfPresent(factors, VerdictFactor.RARITY, scoreRarity(input));

        BigDecimal weightedSum = BigDecimal.ZERO;
        BigDecimal weightTotal = BigDecimal.ZERO;
        for (Map.Entry<VerdictFactor, FactorScore> entry : factors.entrySet()) {
            BigDecimal weight = effectiveWeight(entry.getKey(), input, preferences);
            weightedSum = weightedSum.add(weight.multiply(BigDecimal.valueOf(entry.getValue().score())));
            weightTotal = weightTotal.add(weight);
        }

        int rawScore = weightTotal.signum() == 0
                // No factor could be computed, or the collector explicitly weighted every single
                // one of them to zero. Neutral fallback, never a crafted-looking number - but it
                // must stay unreachable for a profile that merely says nothing (see
                // effectiveWeight), otherwise it hides ten computed factors behind a flat 50.
                ? 50
                : weightedSum.divide(weightTotal, 0, RoundingMode.HALF_UP).intValueExact();

        Verdict verdict = verdictFor(rawScore);
        if (input.negotiationAdvice() == NegotiationAdvice.SKIP_LISTING && input.negotiationPriceDataAvailable()
                && (verdict == Verdict.EXCELLENT_DEAL || verdict == Verdict.GOOD_DEAL || verdict == Verdict.FAIR_PRICE)) {
            // A price genuinely out of market range can never read as a good deal,
            // whatever the edition/completeness quality otherwise suggests.
            //
            // "Genuinely out of range" is the whole point, and it needs price data to be
            // established. SKIP_LISTING also comes back when NO fair value could be computed at
            // all, and downgrading on that meant an unpriceable listing was reported as expensive
            // BECAUSE nothing was known about its price - a judgement drawn from an absence.
            verdict = Verdict.EXPENSIVE;
        }

        ConfidenceLevel overallConfidence = overallConfidence(factors.size());
        return new Outcome(verdict, rawScore, factors, overallConfidence);
    }

    private static Verdict verdictFor(int score) {
        if (score >= EXCELLENT_THRESHOLD) return Verdict.EXCELLENT_DEAL;
        if (score >= GOOD_THRESHOLD) return Verdict.GOOD_DEAL;
        if (score >= FAIR_THRESHOLD) return Verdict.FAIR_PRICE;
        if (score >= EXPENSIVE_THRESHOLD) return Verdict.EXPENSIVE;
        return Verdict.AVOID;
    }

    private static ConfidenceLevel overallConfidence(int factorsComputed) {
        if (factorsComputed >= 8) return ConfidenceLevel.HIGH;
        if (factorsComputed >= 5) return ConfidenceLevel.MEDIUM;
        return ConfidenceLevel.LOW;
    }

    private static void putIfPresent(Map<VerdictFactor, FactorScore> factors, VerdictFactor factor, FactorScore score) {
        if (score != null) {
            factors.put(factor, score);
        }
    }

    /**
     * A factor the profile says NOTHING about weighs what the specification says it weighs - not
     * zero.
     * <p>
     * With {@code getOrDefault(factor, 0)}, a profile whose {@code factorWeights} map was empty
     * silenced all ten factors at once: {@code weightTotal} came out at zero, the "no factor could
     * be computed at all" fallback below fired, and EVERY listing scored exactly 50/100 while the
     * screen displayed ten factor scores and their rationales just above it. That is what the live
     * database held - a profile written with an empty map, which no interface can produce today,
     * and which the defaults could never come back from once the row existed.
     * <p>
     * An explicit {@code 0} is still honoured: silencing a factor on purpose stays possible, it
     * just has to be said.
     */
    private BigDecimal effectiveWeight(VerdictFactor factor, Input input, CollectorPreferences preferences) {
        int baseWeight = preferences.factorWeights()
                .getOrDefault(factor, CollectorPreferences.SPECIFIED_FACTOR_WEIGHTS.getOrDefault(factor, 0));
        if (factor != VerdictFactor.CONDITION) {
            return BigDecimal.valueOf(baseWeight);
        }
        // Two independent reasons the condition can weigh more than its base 15, and they compose:
        // WHAT is being judged (a box/slipcase's condition matters more than a single standard
        // volume's), and HOW MUCH this collector cares about condition at all.
        BigDecimal weight = BigDecimal.valueOf(baseWeight).multiply(importanceFactor(preferences.conditionImportance()));
        return input.conditionAppliesToContainer() ? weight.multiply(new BigDecimal("1.5")) : weight;
    }

    /**
     * {@code conditionImportance} was persisted, validated by the API and returned by
     * {@code GET /preferences} without a single line of the engine ever reading it - the default
     * profile announces "high importance on condition" and nothing acted on it. Its own enum says
     * what it is for: "how much condition should matter".
     * <p>
     * Kept deliberately coarse (halve / leave / half again), on the same scale as the container
     * boost right above, rather than inventing a finer scale nothing asked for.
     */
    private static BigDecimal importanceFactor(WeightLevel importance) {
        return switch (importance) {
            case LOW -> new BigDecimal("0.5");
            case MEDIUM -> BigDecimal.ONE;
            case HIGH -> new BigDecimal("1.5");
        };
    }

    private FactorScore scoreFinalPriceVsFairValue(Input input) {
        if (input.totalFairValue() == null || input.totalFairValue().signum() <= 0) {
            return null;
        }
        BigDecimal ratio = input.totalRealCost().divide(input.totalFairValue(), 4, RoundingMode.HALF_UP);
        int score;
        if (ratio.compareTo(new BigDecimal("0.70")) <= 0) score = 100;
        else if (ratio.compareTo(new BigDecimal("0.85")) <= 0) score = 85;
        else if (ratio.compareTo(BigDecimal.ONE) <= 0) score = 70;
        else if (ratio.compareTo(new BigDecimal("1.10")) <= 0) score = 50;
        else if (ratio.compareTo(new BigDecimal("1.25")) <= 0) score = 30;
        else score = 10;
        String rationale = "Le coût réel représente " + percent(ratio) + " % de la valeur estimée.";
        return new FactorScore(score, rationale, input.anyObservedMarketData() ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreRetailDiscount(Input input, CollectorPreferences preferences) {
        if (input.discountPercent() == null) {
            return null;
        }
        BigDecimal gap = input.discountPercent().subtract(BigDecimal.valueOf(preferences.minimumDiscountVsRetailPercent()));
        int score = clamp(50 + gap.multiply(BigDecimal.valueOf(2)).intValue(), 0, 100);
        String rationale = "Décote vis-à-vis du neuf : " + input.discountPercent().setScale(0, RoundingMode.HALF_UP)
                + " % (minimum attendu : " + preferences.minimumDiscountVsRetailPercent() + " %).";
        return new FactorScore(score, rationale, ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreRealMarketAlignment(Input input) {
        if (input.anyObservedMarketData()) {
            return new FactorScore(90, "Au moins un lot est valorisé à partir d'un prix réellement relevé.", ConfidenceLevel.HIGH);
        }
        return new FactorScore(40, "Aucun prix relevé pour l'instant - la valorisation repose uniquement sur des estimations théoriques.", ConfidenceLevel.LOW);
    }

    private FactorScore scoreCondition(Input input) {
        int score = switch (input.listingCondition()) {
            case MINT_SEALED -> 100;
            case LIKE_NEW -> 85;
            case VERY_GOOD -> 70;
            case GOOD -> 55;
            case ACCEPTABLE -> 35;
            case VISIBLE_DEFECTS -> 15;
        };
        String rationale = "État déclaré : " + label(input.listingCondition())
                + (input.conditionAppliesToContainer() ? " (porte sur le coffret, donc pondéré plus fortement)." : ".");
        return new FactorScore(score, rationale, ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreCompleteness(Input input) {
        List<CollectionStatus> known = input.completenessStatuses().stream().filter(CollectionStatus::isKnown).toList();
        if (known.isEmpty()) {
            return null;
        }
        double averageRatio = known.stream()
                .mapToDouble(status -> 1.0 - (double) status.missingCount() / status.totalVolumes())
                .average().orElse(0);
        int score = clamp((int) Math.round(averageRatio * 100), 0, 100);
        String rationale = "Complétude moyenne sur les éditions connues : " + Math.round(averageRatio * 100) + " %.";
        ConfidenceLevel confidence = known.size() == input.completenessStatuses().size() ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM;
        return new FactorScore(score, rationale, confidence);
    }

    private FactorScore scoreAvailability(Input input, CollectorPreferences preferences) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (!input.anyOutOfPrint()) {
            return new FactorScore(75, "L'édition est toujours au catalogue - aucun risque de disponibilité.", ConfidenceLevel.MEDIUM);
        }
        if (preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced() && input.anyBetterEditionAnnounced()) {
            return new FactorScore(30, "Édition épuisée et meilleure édition annoncée - risque de dévalorisation.", ConfidenceLevel.MEDIUM);
        }
        return new FactorScore(55, "Édition épuisée - signe de rareté autant que de risque, selon la demande.", ConfidenceLevel.LOW);
    }

    private FactorScore scoreEditionQuality(Input input, CollectorPreferences preferences) {
        if (input.itemTiers().isEmpty()) {
            return null;
        }
        // Même règle que pour les poids : un classement vide n'est pas un classement, c'est une
        // absence de classement - et sans lui toute gamme vaut 50, y compris une Perfect.
        List<EditionTier> ranking = preferences.editionTierRanking().isEmpty()
                ? CollectorPreferences.SPECIFIED_EDITION_TIER_RANKING
                : preferences.editionTierRanking();
        double averageScore = input.itemTiers().stream()
                .mapToInt(tier -> tierScore(tier, ranking))
                .average().orElse(50);
        int score = clamp((int) Math.round(averageScore), 0, 100);
        String tiers = input.itemTiers().stream().map(VerdictScorer::label).distinct()
                .collect(java.util.stream.Collectors.joining(", "));
        return new FactorScore(score, "Gamme(s) d'édition : " + tiers, ConfidenceLevel.MEDIUM);
    }

    private static int tierScore(EditionTier tier, List<EditionTier> ranking) {
        int index = ranking.indexOf(tier);
        if (index < 0 || ranking.size() <= 1) {
            return 50;
        }
        double fraction = (double) index / (ranking.size() - 1);
        return (int) Math.round(100 - fraction * 80);
    }

    private FactorScore scoreCostToComplete(Input input) {
        if (!input.costToCompleteKnown() || input.totalNewValue() == null || input.totalNewValue().signum() <= 0) {
            return null;
        }
        BigDecimal cost = input.totalCostToComplete() == null ? BigDecimal.ZERO : input.totalCostToComplete();
        BigDecimal ratio = cost.divide(input.totalNewValue(), 4, RoundingMode.HALF_UP);
        int score = clamp(100 - ratio.multiply(BigDecimal.valueOf(100)).intValue(), 0, 100);
        String rationale = "Compléter la collection coûte environ " + percent(ratio) + " % de sa valeur neuve totale.";
        return new FactorScore(score, rationale, ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreNewEditionRisk(Input input, CollectorPreferences preferences) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (!input.anyBetterEditionAnnounced()) {
            return new FactorScore(90, "Aucune meilleure édition annoncée pour cette série.", ConfidenceLevel.LOW);
        }
        if (preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced()) {
            return new FactorScore(20, "Une meilleure édition a été annoncée - cet exemplaire peut perdre de la valeur.", ConfidenceLevel.MEDIUM);
        }
        return new FactorScore(60, "Une meilleure édition a été annoncée, mais ce n'est pas un critère bloquant pour toi.", ConfidenceLevel.LOW);
    }

    private FactorScore scoreRarity(Input input) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (input.anyOutOfPrint() && !input.anyObservedMarketData()) {
            return new FactorScore(65, "Épuisée et très peu de données de marché - possible véritable rareté.", ConfidenceLevel.LOW);
        }
        return new FactorScore(50, "Aucun signal de rareté marqué.", ConfidenceLevel.LOW);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static BigDecimal percent(BigDecimal ratio) {
        return ratio.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP);
    }

    // Ces justifications sont lues telles quelles par l'utilisateur (voir Lot 30) :
    // y interpoler la constante d'enum laissait passer "GOOD" ou "[STANDARD]" au
    // milieu d'une phrase française. Libellés alignés sur ceux déjà utilisés par
    // l'interface (CONDITION_LABELS / EDITION_TIER_LABELS, web/src/types).
    private static String label(Condition condition) {
        return switch (condition) {
            case MINT_SEALED -> "neuf sous blister";
            case LIKE_NEW -> "comme neuf";
            case VERY_GOOD -> "très bon état";
            case GOOD -> "bon état";
            case ACCEPTABLE -> "état correct";
            case VISIBLE_DEFECTS -> "défauts visibles";
        };
    }

    private static String label(EditionTier tier) {
        return switch (tier) {
            case STANDARD -> "Standard";
            case DELUXE -> "Deluxe";
            case PRESTIGE -> "Prestige";
            case PERFECT -> "Perfect";
            case COLLECTOR -> "Collector";
            case INTEGRAL -> "Intégrale";
            case OTHER -> "Autre";
        };
    }
}
