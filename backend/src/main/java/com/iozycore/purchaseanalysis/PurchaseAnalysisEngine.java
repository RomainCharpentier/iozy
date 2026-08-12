package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Facade orchestrating {@link CompletenessCalculator}, {@link NegotiationEngine}
 * and {@link VerdictScorer} into a full {@link PurchaseAnalysis}. Entirely
 * independent of external APIs and of Spring/JPA/HTTP - every input it
 * needs (matched editions, sibling editions, market observations) is
 * resolved beforehand by {@link PurchaseAnalysisService} so this class can
 * be instantiated and tested directly.
 * <p>
 * Central data-source limitation this whole engine is designed around:
 * none of Vinted, Leboncoin or Rakuten France offers a public API usable
 * to fetch comparable listings (Vinted's "Pro Integrations" is restricted
 * to selected professional accounts, Leboncoin has no public API by
 * strategic choice, and Rakuten France's API is seller-side only, for
 * publishing one's own listings, not browsing others'). Consequently, real
 * market prices only ever come from {@link MarketPriceObservation}s
 * entered manually by the user - see {@link PriceBasis} and {@link MarketPrice}
 * for how observed and theoretical figures are kept strictly separate
 * throughout this engine.
 */
public class PurchaseAnalysisEngine {

    private final CompletenessCalculator completenessCalculator = new CompletenessCalculator();
    private final NegotiationEngine negotiationEngine = new NegotiationEngine();
    private final VerdictScorer verdictScorer = new VerdictScorer();
    private final MarketPriceCalculator marketPriceCalculator = new MarketPriceCalculator();
    private final DuplicateDetector duplicateDetector = new DuplicateDetector();

    /**
     * @param matchedEdition     nullable - the item's edition may not be known to the system yet
     * @param siblingEditions    every other known edition of the same series (used to warn "a Perfect
     *                           edition exists for this work") - excludes {@code matchedEdition} itself
     * @param observations       market price observations recorded for {@code matchedEdition}, empty if none
     * @param alreadyOwnedVolumes "Analyse d'un lot" (brainstorm) - volume numbers of this same series/edition
     *                            already owned (active ownerships), resolved via
     *                            {@link MangaSeries#knownEntityId()} by {@link PurchaseAnalysisService} -
     *                            empty when the series isn't matched to an existing catalog Entity, never guessed
     */
    public record ItemContext(ListingItem item, MangaEdition matchedEdition, List<MangaEdition> siblingEditions,
                               List<MarketPriceObservation> observations, Set<Integer> alreadyOwnedVolumes) {
        public ItemContext {
            siblingEditions = siblingEditions == null ? List.of() : List.copyOf(siblingEditions);
            observations = observations == null ? List.of() : List.copyOf(observations);
            alreadyOwnedVolumes = alreadyOwnedVolumes == null ? Set.of() : Set.copyOf(alreadyOwnedVolumes);
        }
    }

    public PurchaseAnalysis analyze(Listing listing, List<ItemContext> itemContexts, CollectorPreferences preferences) {
        List<ItemAnalysis> itemAnalyses = new ArrayList<>();
        List<Warning> listingWarnings = new ArrayList<>();

        BigDecimal totalNewValue = BigDecimal.ZERO;
        boolean newValueFullyKnown = true;
        BigDecimal totalFairValue = BigDecimal.ZERO;
        boolean anyFairValueKnown = false;
        boolean anyObservedMarketData = false;
        boolean anyEditionMatched = false;
        boolean anyOutOfPrint = false;
        boolean anyBetterEditionAnnounced = false;
        boolean costToCompleteFullyKnown = true;
        BigDecimal totalCostToComplete = BigDecimal.ZERO;
        List<CollectionStatus> completenessStatuses = new ArrayList<>();
        List<EditionTier> itemTiers = new ArrayList<>();

        int totalVolumesInLot = itemContexts.stream().mapToInt(ctx -> ctx.item().includedVolumes().size()).sum();
        BigDecimal totalMaxWorthwhile = BigDecimal.ZERO;
        boolean maxWorthwhileFullyKnown = true;

        for (ItemContext ctx : itemContexts) {
            ListingItem item = ctx.item();
            MangaEdition edition = ctx.matchedEdition();
            int includedCount = item.includedVolumes().size();
            Condition effectiveCondition = item.itemConditionOverride() != null ? item.itemConditionOverride() : listing.condition();

            List<Warning> editionWarnings = new ArrayList<>();
            if (edition == null) {
                editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                        "Edition \"" + item.editionNameRaw() + "\" for \"" + item.series().title()
                                + "\" is not known yet - fill in its reference data for a full analysis.",
                        ConfidenceLevel.LOW));
            }

            MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition, ctx.observations());
            if (perVolumeMarketPrice.basis() == PriceBasis.OBSERVED_MARKET) {
                anyObservedMarketData = true;
            }

            CollectionStatus completeness = completenessCalculator.compute(item.includedVolumes(), edition, perVolumeMarketPrice);
            completenessStatuses.add(completeness);
            if (completeness.isKnown()) {
                if (completeness.missingCount() > 0) {
                    editionWarnings.add(new Warning(WarningSeverity.INFO,
                            completeness.missingCount() + "/" + completeness.totalVolumes()
                                    + " volume(s) missing to complete this edition"
                                    + (completeness.estimatedCostToComplete() != null
                                            ? " (~" + completeness.estimatedCostToComplete().setScale(2, RoundingMode.HALF_UP) + " EUR"
                                                    + (completeness.costToCompleteBasis() == PriceBasis.THEORETICAL_ONLY ? ", theoretical estimate" : ", based on market observations")
                                                    + ")"
                                            : ", cost unknown")
                                    + ".",
                            completeness.costToCompleteBasis() == PriceBasis.OBSERVED_MARKET ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW));
                }
                if (completeness.estimatedCostToComplete() != null) {
                    totalCostToComplete = totalCostToComplete.add(completeness.estimatedCostToComplete());
                } else if (completeness.missingCount() > 0) {
                    costToCompleteFullyKnown = false;
                }
            } else {
                editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                        "Total volume count for \"" + item.editionNameRaw() + "\" is unknown - completeness cannot be computed yet.",
                        ConfidenceLevel.LOW));
                costToCompleteFullyKnown = false;
            }

            BigDecimal itemNewValue = null;
            if (edition != null && edition.retailPriceNewPerVolume() != null) {
                itemNewValue = edition.retailPriceNewPerVolume().multiply(BigDecimal.valueOf(includedCount));
                totalNewValue = totalNewValue.add(itemNewValue);
            } else {
                newValueFullyKnown = false;
            }

            BigDecimal itemFairValue = null;
            if (perVolumeMarketPrice.basis() == PriceBasis.OBSERVED_MARKET) {
                itemFairValue = perVolumeMarketPrice.observedMedian().multiply(BigDecimal.valueOf(includedCount));
            } else if (itemNewValue != null) {
                BigDecimal discount = effectiveCondition.genericDiscountVsRetail();
                if (edition != null && edition.outOfPrint()) {
                    // A discontinued edition tends to retain more of its value - shave the generic discount down.
                    discount = discount.multiply(new BigDecimal("0.85"));
                }
                itemFairValue = itemNewValue.multiply(BigDecimal.ONE.subtract(discount));
            }
            if (itemFairValue != null) {
                totalFairValue = totalFairValue.add(itemFairValue);
                anyFairValueKnown = true;
            }

            if (edition != null) {
                anyEditionMatched = true;
                itemTiers.add(edition.tier());
                if (edition.outOfPrint()) {
                    anyOutOfPrint = true;
                    editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                            "This edition is out of print - could mean rarity or a devaluation risk depending on demand.",
                            ConfidenceLevel.LOW));
                }
                if (edition.betterEditionAnnounced()) {
                    anyBetterEditionAnnounced = true;
                    editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                            edition.betterEditionNote() != null && !edition.betterEditionNote().isBlank()
                                    ? edition.betterEditionNote()
                                    : "A better edition of this series has been announced.",
                            ConfidenceLevel.MEDIUM));
                }
                editionWarnings.addAll(betterTierWarnings(edition, ctx.siblingEditions(), preferences));
            }

            BigDecimal itemCostShare = totalVolumesInLot > 0
                    ? listing.totalRealCost().multiply(BigDecimal.valueOf(includedCount))
                            .divide(BigDecimal.valueOf(totalVolumesInLot), 2, RoundingMode.HALF_UP)
                    : null;

            DuplicateAnalysis duplicates = duplicateDetector.detect(
                    item.includedVolumes(), ctx.alreadyOwnedVolumes(), itemCostShare, perVolumeMarketPrice);
            if (duplicates.hasDuplicates()) {
                editionWarnings.add(new Warning(WarningSeverity.INFO,
                        duplicates.duplicateVolumeNumbers().size() + "/" + includedCount
                                + " volume(s) already owned in this lot - only " + duplicates.usefulVolumeCount()
                                + " useful volume(s)"
                                + (duplicates.pricePerUsefulVolume() != null
                                        ? " (~" + duplicates.pricePerUsefulVolume() + " EUR/useful volume)"
                                        : ".") + ".",
                        ConfidenceLevel.HIGH));
            }
            if (duplicates.usefulVolumeCount() > 0) {
                if (duplicates.maxWorthwhilePrice() != null) {
                    totalMaxWorthwhile = totalMaxWorthwhile.add(duplicates.maxWorthwhilePrice());
                } else {
                    maxWorthwhileFullyKnown = false;
                }
            }

            itemAnalyses.add(new ItemAnalysis(item, edition, completeness, perVolumeMarketPrice, editionWarnings,
                    itemCostShare, duplicates));
        }

        BigDecimal finalNewValue = newValueFullyKnown ? totalNewValue : null;
        BigDecimal finalFairValue = anyFairValueKnown ? totalFairValue : null;
        BigDecimal finalCostToComplete = costToCompleteFullyKnown ? totalCostToComplete : null;

        BigDecimal totalRealCost = listing.totalRealCost();
        BigDecimal totalSavingsAmount = finalNewValue != null ? finalNewValue.subtract(totalRealCost) : null;
        BigDecimal discountPercent = (finalNewValue != null && finalNewValue.signum() > 0)
                ? totalSavingsAmount.divide(finalNewValue, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : null;

        if (finalFairValue == null) {
            listingWarnings.add(new Warning(WarningSeverity.CAUTION,
                    "No market observation and no retail price available for this lot - price recommendations are unavailable.",
                    ConfidenceLevel.LOW));
        }

        NegotiationRecommendation negotiation = negotiationEngine.recommend(listing.askingPrice(), finalFairValue);

        VerdictScorer.Input verdictInput = new VerdictScorer.Input(
                totalRealCost, finalFairValue, finalNewValue, discountPercent, anyObservedMarketData,
                listing.condition(), listing.conditionAppliesToContainer(), List.copyOf(completenessStatuses),
                anyEditionMatched, anyOutOfPrint, List.copyOf(itemTiers), costToCompleteFullyKnown, finalCostToComplete,
                anyBetterEditionAnnounced, negotiation.advice());
        VerdictScorer.Outcome outcome = verdictScorer.score(verdictInput, preferences);

        BigDecimal finalMaxWorthwhile = maxWorthwhileFullyKnown ? totalMaxWorthwhile : null;

        return new PurchaseAnalysis(UUID.randomUUID(), Instant.now(), listing, itemAnalyses, totalRealCost,
                finalNewValue, totalSavingsAmount, discountPercent, negotiation, outcome.verdict(), outcome.score(),
                outcome.factorBreakdown(), listingWarnings, outcome.overallConfidence(), finalMaxWorthwhile);
    }

    /** Warns when a sibling edition of the same series outranks the matched one in the configured tier hierarchy (e.g. the Alice in Borderland case: owning a standard edition while a Perfect edition exists). */
    private List<Warning> betterTierWarnings(MangaEdition matched, List<MangaEdition> siblingEditions, CollectorPreferences preferences) {
        List<EditionTier> ranking = preferences.editionTierRanking();
        int matchedRank = ranking.indexOf(matched.tier());
        if (matchedRank < 0) {
            return List.of();
        }
        List<Warning> warnings = new ArrayList<>();
        for (MangaEdition sibling : siblingEditions) {
            int siblingRank = ranking.indexOf(sibling.tier());
            if (siblingRank >= 0 && siblingRank < matchedRank) {
                warnings.add(new Warning(WarningSeverity.CAUTION,
                        "A " + sibling.tier() + " edition (\"" + sibling.editionName() + "\") exists for this series - "
                                + "consider it over this " + matched.tier() + " edition.",
                        ConfidenceLevel.MEDIUM));
            }
        }
        return warnings;
    }
}
