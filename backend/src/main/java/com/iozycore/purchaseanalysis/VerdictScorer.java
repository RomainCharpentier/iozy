package com.iozycore.purchaseanalysis;

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
                         boolean anyBetterEditionAnnounced, NegotiationAdvice negotiationAdvice) {
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
                ? 50 // no factor could be computed at all - neutral fallback, never a crafted-looking number
                : weightedSum.divide(weightTotal, 0, RoundingMode.HALF_UP).intValueExact();

        Verdict verdict = verdictFor(rawScore);
        if (input.negotiationAdvice() == NegotiationAdvice.SKIP_LISTING
                && (verdict == Verdict.EXCELLENT_DEAL || verdict == Verdict.GOOD_DEAL || verdict == Verdict.FAIR_PRICE)) {
            // A price genuinely out of market range can never read as a good deal,
            // whatever the edition/completeness quality otherwise suggests.
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

    private BigDecimal effectiveWeight(VerdictFactor factor, Input input, CollectorPreferences preferences) {
        int baseWeight = preferences.factorWeights().getOrDefault(factor, 0);
        if (factor == VerdictFactor.CONDITION && input.conditionAppliesToContainer()) {
            // A box/slipcase's condition matters more than a single standard volume's.
            return BigDecimal.valueOf(baseWeight).multiply(new BigDecimal("1.5"));
        }
        return BigDecimal.valueOf(baseWeight);
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
        String rationale = "Real cost is " + percent(ratio) + "% of the estimated fair value.";
        return new FactorScore(score, rationale, input.anyObservedMarketData() ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreRetailDiscount(Input input, CollectorPreferences preferences) {
        if (input.discountPercent() == null) {
            return null;
        }
        BigDecimal gap = input.discountPercent().subtract(BigDecimal.valueOf(preferences.minimumDiscountVsRetailPercent()));
        int score = clamp(50 + gap.multiply(BigDecimal.valueOf(2)).intValue(), 0, 100);
        String rationale = "Discount vs retail is " + input.discountPercent().setScale(0, RoundingMode.HALF_UP)
                + "% (minimum expected: " + preferences.minimumDiscountVsRetailPercent() + "%).";
        return new FactorScore(score, rationale, ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreRealMarketAlignment(Input input) {
        if (input.anyObservedMarketData()) {
            return new FactorScore(90, "At least one item is priced from a real market observation.", ConfidenceLevel.HIGH);
        }
        return new FactorScore(40, "No market observation recorded yet - pricing relies on theoretical estimates only.", ConfidenceLevel.LOW);
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
        String rationale = "Declared condition: " + input.listingCondition()
                + (input.conditionAppliesToContainer() ? " (applies to the box/slipcase, weighted more heavily)." : ".");
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
        String rationale = "Average completeness across known editions: " + Math.round(averageRatio * 100) + "%.";
        ConfidenceLevel confidence = known.size() == input.completenessStatuses().size() ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM;
        return new FactorScore(score, rationale, confidence);
    }

    private FactorScore scoreAvailability(Input input, CollectorPreferences preferences) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (!input.anyOutOfPrint()) {
            return new FactorScore(75, "The edition is still in print - no availability risk.", ConfidenceLevel.MEDIUM);
        }
        if (preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced() && input.anyBetterEditionAnnounced()) {
            return new FactorScore(30, "Edition is out of print and a better edition has been announced - devaluation risk.", ConfidenceLevel.MEDIUM);
        }
        return new FactorScore(55, "Edition is out of print - could mean rarity as much as risk, depending on demand.", ConfidenceLevel.LOW);
    }

    private FactorScore scoreEditionQuality(Input input, CollectorPreferences preferences) {
        if (input.itemTiers().isEmpty()) {
            return null;
        }
        List<EditionTier> ranking = preferences.editionTierRanking();
        double averageScore = input.itemTiers().stream()
                .mapToInt(tier -> tierScore(tier, ranking))
                .average().orElse(50);
        int score = clamp((int) Math.round(averageScore), 0, 100);
        return new FactorScore(score, "Edition tier(s): " + input.itemTiers(), ConfidenceLevel.MEDIUM);
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
        String rationale = "Completing the collection costs about " + percent(ratio) + "% of its full retail value.";
        return new FactorScore(score, rationale, ConfidenceLevel.MEDIUM);
    }

    private FactorScore scoreNewEditionRisk(Input input, CollectorPreferences preferences) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (!input.anyBetterEditionAnnounced()) {
            return new FactorScore(90, "No better edition announced for this series.", ConfidenceLevel.LOW);
        }
        if (preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced()) {
            return new FactorScore(20, "A better edition has been announced - this copy may lose value.", ConfidenceLevel.MEDIUM);
        }
        return new FactorScore(60, "A better edition has been announced, but this is not a blocking preference.", ConfidenceLevel.LOW);
    }

    private FactorScore scoreRarity(Input input) {
        if (!input.anyEditionMatched()) {
            return null;
        }
        if (input.anyOutOfPrint() && !input.anyObservedMarketData()) {
            return new FactorScore(65, "Out of print with very little market data - could be genuinely rare.", ConfidenceLevel.LOW);
        }
        return new FactorScore(50, "No strong rarity signal.", ConfidenceLevel.LOW);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static BigDecimal percent(BigDecimal ratio) {
        return ratio.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP);
    }
}
