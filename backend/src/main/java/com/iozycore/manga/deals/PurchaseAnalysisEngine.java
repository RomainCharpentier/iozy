package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.iozycore.core.insights.ConfidenceLevel;

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
     * @param alreadyOwnedVolumes "Lot analysis" (brainstorm) - volume numbers of this same series/edition
     *                            already owned (active ownerships), resolved via
     *                            {@link MangaSeries#knownEntityId()} by {@link PurchaseAnalysisService} -
     *                            empty when the series isn't matched to an existing catalog Entity, never guessed
     * @param aiEstimate          Phase 2 (AI assistance) - see {@link MarketPriceCalculator#computePerVolume(MangaEdition, List, AiPriceEstimate)}
     */
    public record ItemContext(ListingItem item, MangaEdition matchedEdition, List<MangaEdition> siblingEditions,
                               List<MarketPriceObservation> observations, Set<Integer> alreadyOwnedVolumes,
                               AiPriceEstimate aiEstimate) {
        public ItemContext {
            siblingEditions = siblingEditions == null ? List.of() : List.copyOf(siblingEditions);
            observations = observations == null ? List.of() : List.copyOf(observations);
            alreadyOwnedVolumes = alreadyOwnedVolumes == null ? Set.of() : Set.copyOf(alreadyOwnedVolumes);
        }

        /** Existing call sites that don't resolve an AI estimate (most tests, and any future non-AI caller) - defaults to none. */
        public ItemContext(ListingItem item, MangaEdition matchedEdition, List<MangaEdition> siblingEditions,
                            List<MarketPriceObservation> observations, Set<Integer> alreadyOwnedVolumes) {
            this(item, matchedEdition, siblingEditions, observations, alreadyOwnedVolumes, null);
        }
    }

    public PurchaseAnalysis analyze(Listing listing, List<ItemContext> itemContexts, CollectorPreferences preferences) {
        return analyze(listing, itemContexts, preferences, 0);
    }

    public PurchaseAnalysis analyze(Listing listing, List<ItemContext> itemContexts,
                                     CollectorPreferences preferences, int wishlistedCount) {
        return analyze(listing, itemContexts, preferences, wishlistedCount, null);
    }

    /**
     * @param wishlistedCount items of the lot already in the wishes - count established by the application
     *                        layer, which alone knows the wishlist (the engine stays a pure domain)
     */
    /**
     * @param currentListingIdentity identity of the listing assessed (see {@link ListingIdentity}).
     *                               The observations coming from THIS listing are dropped from its own
     *                               reference: an offer already analysed once would otherwise be compared
     *                               to its own price, and say "at market price".
     *                               {@code null} when the listing has no identity.
     */
    public PurchaseAnalysis analyze(Listing listing, List<ItemContext> itemContexts,
                                     CollectorPreferences preferences, int wishlistedCount,
                                     String currentListingIdentity) {
        List<ItemAnalysis> itemAnalyses = new ArrayList<>();
        List<Warning> listingWarnings = new ArrayList<>();
        // Read once for the whole analysis: the freshness of the comparables must
        // be judged at the same date from start to end. The rules that use it
        // stay testable without a clock, since the date is passed to them.
        LocalDate today = LocalDate.now();

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
                // Two very different situations behind the same missing
                // page: an edition name was given but is still unknown to the
                // catalogue (we can create it), or the user said they do not
                // know (there is nothing to create, they must look at the listing).
                // The same message for both would give advice that cannot be applied.
                editionWarnings.add(item.editionIsUnknown()
                        ? new Warning(WarningSeverity.CAUTION,
                                "L'édition de \"" + item.series().title() + "\" n'est pas précisée - "
                                        + "la complétude et la valeur neuve ne peuvent pas être calculées.",
                                ConfidenceLevel.LOW)
                        : new Warning(WarningSeverity.CAUTION,
                                "L'édition \"" + item.editionNameRaw() + "\" de \"" + item.series().title()
                                        + "\" n'est pas encore renseignée - complète sa fiche pour une analyse complète.",
                                ConfidenceLevel.LOW));
            }

            MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition, ctx.observations(), ctx.aiEstimate());
            if (perVolumeMarketPrice.basis() == PriceBasis.OBSERVED_MARKET) {
                anyObservedMarketData = true;
            }

            // Completeness is what the user would hold AFTER this purchase: the lot plus the
            // volumes they already own. Counting the lot alone told someone who owns 1-6 of 8
            // that buying 7-8 left "6 missing", while the block above said the lot fills
            // exactly their gaps. Without a known collection (no owned volume), it is the lot alone.
            Set<Integer> heldAfterPurchase = new HashSet<>(item.includedVolumes());
            heldAfterPurchase.addAll(ctx.alreadyOwnedVolumes());
            boolean countsOwnedVolumes = !ctx.alreadyOwnedVolumes().isEmpty();
            CollectionStatus completeness = completenessCalculator.compute(heldAfterPurchase, edition, perVolumeMarketPrice);
            completenessStatuses.add(completeness);
            if (completeness.isKnown()) {
                if (completeness.missingCount() > 0) {
                    editionWarnings.add(new Warning(WarningSeverity.INFO,
                            completeness.missingCount() + "/" + completeness.totalVolumes()
                                    + (completeness.missingCount() > 1 ? " tomes manquants" : " tome manquant")
                                    + " pour compléter cette édition"
                                    + (countsOwnedVolumes ? ", en comptant ceux que tu possèdes" : "")
                                    + (completeness.estimatedCostToComplete() != null
                                            ? " (~" + String.format(Locale.FRANCE, "%,.2f €", completeness.estimatedCostToComplete())
                                                    + switch (completeness.costToCompleteBasis()) {
                                                        case THEORETICAL_ONLY -> ", estimation théorique";
                                                        case AI_ESTIMATED -> ", estimation IA - non vérifiée";
                                                        case OBSERVED_MARKET -> ", d'après des prix relevés";
                                                    }
                                                    + ")"
                                            : ", coût inconnu")
                                    + ".",
                            completeness.costToCompleteBasis() == PriceBasis.OBSERVED_MARKET ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW));
                }
                if (completeness.estimatedCostToComplete() != null) {
                    totalCostToComplete = totalCostToComplete.add(completeness.estimatedCostToComplete());
                } else if (completeness.missingCount() > 0) {
                    costToCompleteFullyKnown = false;
                }
            } else {
                // Edition not specified: the first warning already said it,
                // repeating it in another form informs nobody.
                if (!item.editionIsUnknown()) {
                    editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                            "Le nombre total de tomes de \"" + item.editionNameRaw() + "\" est inconnu - la complétude ne peut pas être calculée.",
                            ConfidenceLevel.LOW));
                }
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
            } else if (perVolumeMarketPrice.basis() == PriceBasis.AI_ESTIMATED) {
                // Already a resale price estimate for THIS precise condition (see the prompt of
                // GeminiMarketPriceAdvisor) - unlike the theoretical case below, no generic
                // discount to apply again, that would count the depreciation twice.
                itemFairValue = perVolumeMarketPrice.aiEstimatedPrice().multiply(BigDecimal.valueOf(includedCount));
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
                            "Cette édition est épuisée - signe de rareté autant que risque de dévalorisation, selon la demande.",
                            ConfidenceLevel.LOW));
                }
                if (edition.betterEditionAnnounced()) {
                    anyBetterEditionAnnounced = true;
                    editionWarnings.add(new Warning(WarningSeverity.CAUTION,
                            edition.betterEditionNote() != null && !edition.betterEditionNote().isBlank()
                                    ? edition.betterEditionNote()
                                    : "Une meilleure édition de cette série a été annoncée.",
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
            // Duplicates no longer produce a warning in prose: the same
            // information already goes out, structured and with numbers, in
            // ItemAnalysis.duplicates - the only client rendered it and then filtered
            // this duplicate out by searching for "already owned" in the text, a
            // filter that the translation of this batch would have broken silently.
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
                    "Aucun prix relevé ni prix neuf connu pour ce lot - aucune recommandation de prix possible.",
                    ConfidenceLevel.LOW));
        }

        // The market reference is computed BEFORE the verdict: the factor
        // REAL_MARKET_ALIGNMENT needs to know whether a structurally
        // COMPARABLE observation exists, not only whether an observation exists. Without that, it
        // said "price really observed, high confidence" under a Price block
        // saying "none on a comparable lot" (see scoreRealMarketAlignment).
        MarketReference reference = referenceDeLot(itemContexts, today, currentListingIdentity);

        // One price verdict per screen, and it is the Price section's: only a usable reference
        // may judge the price. The negotiation still gives amounts from the estimated value,
        // but it no longer says "a correct range" or "skip it" when that section says the
        // price cannot be placed.
        boolean priceCanBePlaced = DealAssessmentPolicy.positionOf(listing.askingPrice(), reference)
                != PricePosition.REFERENCE_UNAVAILABLE;
        NegotiationRecommendation negotiation = negotiationEngine.recommend(
                listing.askingPrice(), finalFairValue, priceCanBePlaced);

        VerdictScorer.Input verdictInput = new VerdictScorer.Input(
                totalRealCost, finalFairValue, finalNewValue, discountPercent, anyObservedMarketData,
                listing.condition(), listing.conditionAppliesToContainer(), List.copyOf(completenessStatuses),
                anyEditionMatched, anyOutOfPrint, List.copyOf(itemTiers), costToCompleteFullyKnown, finalCostToComplete,
                anyBetterEditionAnnounced, negotiation.advice(), negotiation.priceDataAvailable(),
                reference.sampleSize() > 0);
        VerdictScorer.Outcome outcome = verdictScorer.score(verdictInput, preferences);

        BigDecimal finalMaxWorthwhile = maxWorthwhileFullyKnown ? totalMaxWorthwhile : null;

        // The three dimensions, computed separately then presented together
        // (see ListingAssessment): what the lot brings, where its price stands,
        // and what must be checked. They do not make up for each other.
        // What the lot brings is judged on the ACQUISITION COST (it is what we
        // pay); the price is judged on the LISTING PRICE (it is what the
        // comparables are worth, without fees). The two bases are not swapped.
        CollectionFit fit = CollectionFit.fromItemBreakdown(itemAnalyses, wishlistedCount, totalRealCost);
        // The "very low price" vigilance only triggers on a usable
        // reference: accusing a listing on the strength of a benchmark that we refuse
        // to use elsewhere would be double standards.
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                listing.description(), listing.photoUrls().size(), listing.askingPrice(),
                reference.isUsable() ? reference.price() : null);
        ListingAssessment assessment = ListingAssessment.of(fit, reference, listing.askingPrice(), trust);

        return new PurchaseAnalysis(UUID.randomUUID(), Instant.now(), listing, itemAnalyses, totalRealCost,
                finalNewValue, totalSavingsAmount, discountPercent, negotiation, outcome.verdict(), outcome.score(),
                outcome.factorBreakdown(), listingWarnings, outcome.overallConfidence(), finalMaxWorthwhile,
                assessment);
    }

    /**
     * The market reference of the LOT, built series by series from the only
     * observations that are structurally comparable.
     * <p>
     * Three accepted refusals here. One: the observations of another lot shape do not
     * count - a single volume says nothing about the price of a complete set
     * ({@link MarketComparableSelector}). Two: an AI estimate or a catalogue
     * new price never become "the market" - they stay useful
     * for the cost to complete, the negotiation and the overall verdict, but
     * showing them as a reference would give a guess the authority of a
     * finding. Three: a single series without a reference is enough to make the whole
     * lot unavailable, because adding up what we know while ignoring the rest
     * would produce a reference that is too low, so a lot that is falsely "too expensive".
     */
    private MarketReference referenceDeLot(List<ItemContext> contexts, LocalDate today, String currentListing) {
        List<MarketReference> parSerie = new ArrayList<>();
        for (ItemContext ctx : contexts) {
            int tomes = ctx.item().includedVolumes().size();
            MarketComparableSelector.Selection selection = MarketComparableSelector.selectFor(
                    ctx.matchedEdition(), tomes, ctx.observations(), today, currentListing);
            parSerie.add(MarketReference.fromComparables(ctx.matchedEdition(), tomes, selection, today));
        }
        return MarketReference.sum(parSerie);
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
                        "Une édition " + sibling.tier() + " (\"" + sibling.editionName() + "\") existe pour cette "
                                + "série - à préférer à cette édition " + matched.tier() + ".",
                        ConfidenceLevel.MEDIUM));
            }
        }
        return warnings;
    }
}
