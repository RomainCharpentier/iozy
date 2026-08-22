package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** End-to-end tests of {@link PurchaseAnalysisEngine}, replaying the specification's worked examples. */
class PurchaseAnalysisEngineTest {

    private final PurchaseAnalysisEngine engine = new PurchaseAnalysisEngine();
    private final CollectorPreferences defaults = CollectorPreferences.defaults();

    private static ListingItem item(String series, Set<Integer> includedVolumes) {
        return new ListingItem(new MangaSeries(series, null), "Standard", includedVolumes, null);
    }

    private static Listing listing(BigDecimal askingPrice, BigDecimal shippingFee, BigDecimal buyerProtectionFee,
                                    Condition condition, ListingItem... items) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Test listing", null, askingPrice,
                shippingFee, buyerProtectionFee, condition, false, List.of(items), List.of(), Instant.now());
    }

    @Test
    void a_market_price_with_no_recorded_observation_is_never_reported_as_observed() {
        MangaEdition edition = MangaEdition.create("Death Note", "Black Edition", EditionTier.DELUXE, "Kana",
                6, new BigDecimal("14.90"), false, false, null);
        ListingItem item = item("Death Note", Set.of(1, 2, 3));
        Listing listing = listing(new BigDecimal("30"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.VERY_GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of())), defaults);

        MarketPrice marketPrice = analysis.itemBreakdown().get(0).marketPrice();
        assertThat(marketPrice.observationCount()).isZero();
        assertThat(marketPrice.observedMedian()).isNull();
        assertThat(marketPrice.observedLow()).isNull();
        assertThat(marketPrice.observedHigh()).isNull();
        assertThat(marketPrice.basis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
    }

    @Test
    void an_ai_price_estimate_feeds_fair_value_and_negotiation_when_there_is_no_real_observation() {
        // Prix neuf 20€/tome, état GOOD (45% de décote générique -> 11€/tome théorique) - mais l'IA
        // estime 16€/tome (édition recherchée) : le prix retenu doit être celui de l'IA, pas la
        // décote générique réappliquée par-dessus (ce serait compter la dépréciation deux fois).
        MangaEdition edition = MangaEdition.create("Vinland Saga", "Deluxe", EditionTier.DELUXE, "Kurokawa", 10,
                new BigDecimal("20.00"), false, false, null);
        ListingItem item = item("Vinland Saga", Set.of(1));
        Listing listing = listing(new BigDecimal("16"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);
        AiPriceEstimate aiEstimate = new AiPriceEstimate(new BigDecimal("16.00"), ConfidenceLevel.MEDIUM, "Tome recherché");

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of(), aiEstimate)),
                defaults);

        MarketPrice marketPrice = analysis.itemBreakdown().get(0).marketPrice();
        assertThat(marketPrice.basis()).isEqualTo(PriceBasis.AI_ESTIMATED);
        assertThat(marketPrice.aiEstimatedPrice()).isEqualByComparingTo(new BigDecimal("16.00"));
        // Garde-fou : une estimation IA n'est jamais comptée comme une donnée de marché réelle.
        assertThat(marketPrice.observationCount()).isZero();

        assertThat(analysis.negotiation().maxPrice()).isEqualByComparingTo(new BigDecimal("16.80")); // 16 * 1.05
        assertThat(analysis.negotiation().targetPriceMin()).isEqualByComparingTo(new BigDecimal("15.20")); // 16 * 0.95
    }

    @Test
    void my_home_hero_1_to_17_of_26_reports_completeness_and_flags_an_overpriced_asking_price() {
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null);
        Set<Integer> owned = Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
        ListingItem item = item("My Home Hero", owned);
        Listing listing = listing(new BigDecimal("90"), new BigDecimal("5"), new BigDecimal("2"), Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of())), defaults);

        assertThat(analysis.totalRealCost()).isEqualByComparingTo(new BigDecimal("97"));

        CollectionStatus completeness = analysis.itemBreakdown().get(0).completeness();
        assertThat(completeness.totalVolumes()).isEqualTo(26);
        assertThat(completeness.missingCount()).isEqualTo(9);
        assertThat(completeness.missingVolumeNumbers()).isEqualTo(List.of(18, 19, 20, 21, 22, 23, 24, 25, 26));
        assertThat(completeness.estimatedCostToComplete()).isEqualByComparingTo(new BigDecimal("62.10"));
        assertThat(completeness.costToCompleteBasis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);

        // 17 * 6.90 = 117.30 new value, fair value at GOOD condition (45% off) = 64.515 -
        // asking 90 EUR is far beyond what a realistic offer could close to, hence a skip.
        assertThat(analysis.negotiation().advice()).isEqualTo(NegotiationAdvice.SKIP_LISTING);
        assertThat(analysis.verdict()).isIn(Verdict.EXPENSIVE, Verdict.AVOID);
    }

    @Test
    void a_standard_edition_is_warned_against_when_a_perfect_edition_exists_for_the_same_series() {
        MangaEdition standard = MangaEdition.create("Alice in Borderland", "Standard", EditionTier.STANDARD,
                "Ki-oon", 18, new BigDecimal("7.60"), false, false, null);
        MangaEdition perfect = MangaEdition.create("Alice in Borderland", "Perfect Edition", EditionTier.PERFECT,
                "Ki-oon", 9, new BigDecimal("19.90"), false, false, null);
        ListingItem item = item("Alice in Borderland", Set.of(1, 2, 3));
        Listing listing = listing(new BigDecimal("15"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, standard, List.of(perfect), List.of(), Set.of())), defaults);

        assertThat(analysis.itemBreakdown().get(0).editionWarnings())
                .anyMatch(warning -> warning.message().contains("PERFECT"));
    }

    @Test
    void an_out_of_print_edition_with_a_better_edition_announced_surfaces_both_warnings() {
        MangaEdition edition = MangaEdition.create("Parasyte", "Standard", EditionTier.STANDARD, "Tonkam", 10,
                new BigDecimal("7.50"), true, true, "A Perfect Edition has been announced for 2026.");
        ListingItem item = item("Parasyte", Set.of(1, 2));
        Listing listing = listing(new BigDecimal("10"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of())), defaults);

        List<String> messages = analysis.itemBreakdown().get(0).editionWarnings().stream().map(Warning::message).toList();
        assertThat(messages).anyMatch(m -> m.contains("épuisée"));
        assertThat(messages).anyMatch(m -> m.contains("Perfect Edition has been announced"));
    }

    @Test
    void an_unmatched_edition_produces_a_caution_warning_instead_of_a_silent_gap() {
        ListingItem item = item("Some Unknown Manga", Set.of(1));
        Listing listing = listing(new BigDecimal("10"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, null, List.of(), List.of(), Set.of())), defaults);

        assertThat(analysis.itemBreakdown().get(0).matchedEdition()).isNull();
        assertThat(analysis.itemBreakdown().get(0).editionWarnings())
                .anyMatch(w -> w.severity() == WarningSeverity.CAUTION && w.message().contains("n'est pas encore renseignée"));
        assertThat(analysis.negotiation().advice()).isEqualTo(NegotiationAdvice.SKIP_LISTING); // no price data at all
    }

    @Test
    void already_owned_volumes_are_flagged_as_duplicates_and_reduce_the_worthwhile_price() {
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null);
        ListingItem item = item("My Home Hero", Set.of(1, 2, 3));
        Listing listing = listing(new BigDecimal("20"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of(1, 2))),
                defaults);

        DuplicateAnalysis duplicates = analysis.itemBreakdown().get(0).duplicates();
        assertThat(duplicates.duplicateVolumeNumbers()).containsExactlyInAnyOrder(1, 2);
        assertThat(duplicates.usefulVolumeCount()).isEqualTo(1);
        // Aucun avertissement en prose sur les doublons : l'information vit
        // dans DuplicateAnalysis ci-dessus, jamais dupliquee en texte (Lot 30).
        assertThat(analysis.itemBreakdown().get(0).editionWarnings())
                .noneMatch(w -> w.message().toLowerCase().contains("doublon"));
        assertThat(analysis.totalMaxWorthwhilePrice()).isEqualByComparingTo(new BigDecimal("6.90")); // 1 useful volume
        // Duplicates never affect the core verdict/negotiation math (unchanged from before this
        // feature existed) - fair value below is still computed from all 3 volumes, not just the useful one.
        assertThat(analysis.negotiation()).isNotNull();
    }

    @Test
    void no_already_owned_volumes_means_no_duplicate_warning_and_the_full_lot_stays_worthwhile() {
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null);
        ListingItem item = item("My Home Hero", Set.of(1, 2, 3));
        Listing listing = listing(new BigDecimal("20"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, item);

        PurchaseAnalysis analysis = engine.analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), List.of(), Set.of())),
                defaults);

        DuplicateAnalysis duplicates = analysis.itemBreakdown().get(0).duplicates();
        assertThat(duplicates.hasDuplicates()).isFalse();
        assertThat(duplicates.usefulVolumeCount()).isEqualTo(3);
        assertThat(analysis.totalMaxWorthwhilePrice()).isEqualByComparingTo(new BigDecimal("20.70")); // 3 * 6.90
    }
}
