package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;

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
     * @param aiEstimate          Phase 2 (assistance IA) - see {@link MarketPriceCalculator#computePerVolume(MangaEdition, List, AiPriceEstimate)}
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

    /**
     * @param wishlistedCount elements du lot deja presents dans les envies - compte etabli par la couche
     *                        application, qui seule connait la wishlist (le moteur reste un domaine pur)
     */
    public PurchaseAnalysis analyze(Listing listing, List<ItemContext> itemContexts,
                                     CollectorPreferences preferences, int wishlistedCount) {
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
                        "L'édition \"" + item.editionNameRaw() + "\" de \"" + item.series().title()
                                + "\" n'est pas encore renseignée - complète sa fiche pour une analyse complète.",
                        ConfidenceLevel.LOW));
            }

            MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition, ctx.observations(), ctx.aiEstimate());
            if (perVolumeMarketPrice.basis() == PriceBasis.OBSERVED_MARKET) {
                anyObservedMarketData = true;
            }

            CollectionStatus completeness = completenessCalculator.compute(item.includedVolumes(), edition, perVolumeMarketPrice);
            completenessStatuses.add(completeness);
            if (completeness.isKnown()) {
                if (completeness.missingCount() > 0) {
                    editionWarnings.add(new Warning(WarningSeverity.INFO,
                            completeness.missingCount() + "/" + completeness.totalVolumes()
                                    + " tome(s) manquant(s) pour compléter cette édition"
                                    + (completeness.estimatedCostToComplete() != null
                                            ? " (~" + completeness.estimatedCostToComplete().setScale(2, RoundingMode.HALF_UP) + " €"
                                                    + switch (completeness.costToCompleteBasis()) {
                                                        case THEORETICAL_ONLY -> ", estimation théorique";
                                                        case AI_ESTIMATED -> ", estimation IA - non vérifiée";
                                                        case OBSERVED_MARKET -> ", d'après des prix relevés";
                                                    }
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
                        "Le nombre total de tomes de \"" + item.editionNameRaw() + "\" est inconnu - la complétude ne peut pas être calculée.",
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
            } else if (perVolumeMarketPrice.basis() == PriceBasis.AI_ESTIMATED) {
                // Déjà une estimation de prix de revente pour CET état précis (voir le prompt de
                // GeminiMarketPriceAdvisor) - contrairement au cas théorique ci-dessous, pas de décote
                // générique à réappliquer, ce serait compter la dépréciation deux fois.
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
            // Les doublons ne produisent plus d'avertissement en prose : la même
            // information part déjà, structurée et chiffrée, dans
            // ItemAnalysis.duplicates - le seul client la rendait puis filtrait
            // ce doublon-ci en cherchant "already owned" dans le texte, un
            // filtre que la traduction de ce lot aurait cassé en silence.
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

        NegotiationRecommendation negotiation = negotiationEngine.recommend(listing.askingPrice(), finalFairValue);

        VerdictScorer.Input verdictInput = new VerdictScorer.Input(
                totalRealCost, finalFairValue, finalNewValue, discountPercent, anyObservedMarketData,
                listing.condition(), listing.conditionAppliesToContainer(), List.copyOf(completenessStatuses),
                anyEditionMatched, anyOutOfPrint, List.copyOf(itemTiers), costToCompleteFullyKnown, finalCostToComplete,
                anyBetterEditionAnnounced, negotiation.advice());
        VerdictScorer.Outcome outcome = verdictScorer.score(verdictInput, preferences);

        BigDecimal finalMaxWorthwhile = maxWorthwhileFullyKnown ? totalMaxWorthwhile : null;

        // Les trois dimensions, calculees separement puis presentees ensemble
        // (voir ListingAssessment) : ce que le lot apporte, ou se situe son prix,
        // et ce qu'il faut verifier. Elles ne se compensent pas entre elles.
        CollectionFit fit = CollectionFit.fromItemBreakdown(itemAnalyses, wishlistedCount, totalRealCost);
        BigDecimal reference = referenceDeLot(itemAnalyses);
        ConfidenceLevel referenceConfidence = confianceDeReference(itemAnalyses);
        PricePosition position = DealAssessmentPolicy.positionOf(
                listing.askingPrice(), reference, referenceConfidence);
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                listing.description(), listing.photoUrls().size(), listing.askingPrice(), reference);
        ListingAssessment assessment = ListingAssessment.of(fit, position, reference, referenceConfidence,
                DealAssessmentPolicy.deviationPercent(listing.askingPrice(), reference), trust);

        return new PurchaseAnalysis(UUID.randomUUID(), Instant.now(), listing, itemAnalyses, totalRealCost,
                finalNewValue, totalSavingsAmount, discountPercent, negotiation, outcome.verdict(), outcome.score(),
                outcome.factorBreakdown(), listingWarnings, outcome.overallConfidence(), finalMaxWorthwhile,
                assessment);
    }

    /**
     * La reference marche du LOT : la somme des references par serie, quand
     * chacune en a une. Construite a partir des elements faute de comparables
     * lot-a-lot - l'UI doit donc dire d'ou elle vient, et sa confiance est
     * plafonnee en consequence (voir confianceDeReference).
     * <p>
     * Rend null des qu'une seule serie n'a pas de reference : additionner ce
     * qu'on connait en ignorant ce qu'on ignore produirait une reference
     * systematiquement trop basse, donc un lot systematiquement "trop cher".
     */
    private BigDecimal referenceDeLot(List<ItemAnalysis> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (ItemAnalysis item : items) {
            BigDecimal parTome = referenceParTome(item);
            if (parTome == null) {
                return null;
            }
            total = total.add(parTome.multiply(BigDecimal.valueOf(item.item().includedVolumes().size())));
        }
        return items.isEmpty() ? null : total;
    }

    /** Le prix observe l'emporte sur l'estime : une donnee relevee vaut mieux qu'un calcul. */
    private BigDecimal referenceParTome(ItemAnalysis item) {
        MarketPrice prix = item.marketPrice();
        if (prix == null) {
            return null;
        }
        if (prix.observedMedian() != null) {
            return prix.observedMedian();
        }
        return prix.aiEstimatedPrice() != null ? prix.aiEstimatedPrice() : prix.theoreticalEstimate();
    }

    /**
     * La confiance de la reference du lot, degradee deliberement.
     * <p>
     * Elle vaut celle de la serie la MOINS bien documentee - une reference n'est
     * pas plus solide que son maillon faible. Et elle ne depasse jamais MEDIUM
     * des que le lot compte plusieurs series : additionner des references
     * unitaires pour juger un lot est une approximation, meme quand chaque
     * terme est bien connu.
     */
    private ConfidenceLevel confianceDeReference(List<ItemAnalysis> items) {
        if (items.isEmpty()) {
            return ConfidenceLevel.LOW;
        }
        ConfidenceLevel pire = ConfidenceLevel.HIGH;
        for (ItemAnalysis item : items) {
            MarketPrice prix = item.marketPrice();
            ConfidenceLevel c = prix == null ? ConfidenceLevel.LOW : prix.confidence();
            if (c == ConfidenceLevel.LOW || pire == ConfidenceLevel.LOW) {
                pire = ConfidenceLevel.LOW;
            } else if (c == ConfidenceLevel.MEDIUM) {
                pire = ConfidenceLevel.MEDIUM;
            }
        }
        if (items.size() > 1 && pire == ConfidenceLevel.HIGH) {
            return ConfidenceLevel.MEDIUM;
        }
        return pire;
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
