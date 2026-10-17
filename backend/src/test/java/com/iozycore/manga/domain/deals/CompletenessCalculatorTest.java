package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CompletenessCalculatorTest {

    private final CompletenessCalculator calculator = new CompletenessCalculator();

    @Test
    void completeness_is_unknown_when_no_edition_is_matched() {
        CollectionStatus status = calculator.compute(Set.of(1, 2, 3), null, null);

        assertThat(status.isKnown()).isFalse();
        assertThat(status.missingCount()).isNull();
        assertThat(status.estimatedCostToComplete()).isNull();
    }

    @Test
    void completeness_is_unknown_when_total_volume_count_is_unknown() {
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                null, new BigDecimal("6.90"), false, false, null);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3), edition, null);

        assertThat(status.isKnown()).isFalse();
    }

    @Test
    void my_home_hero_1_to_17_out_of_26_reports_9_missing_volumes_with_theoretical_cost() {
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null);
        Set<Integer> owned = Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
        MarketPrice theoreticalOnly = MarketPrice.noObservations(new BigDecimal("6.90"), ConfidenceLevel.LOW);

        CollectionStatus status = calculator.compute(owned, edition, theoreticalOnly);

        assertThat(status.isKnown()).isTrue();
        assertThat(status.totalVolumes()).isEqualTo(26);
        assertThat(status.missingCount()).isEqualTo(9);
        assertThat(status.missingVolumeNumbers()).isEqualTo(List.of(18, 19, 20, 21, 22, 23, 24, 25, 26));
        assertThat(status.costToCompleteBasis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
        assertThat(status.estimatedCostToComplete()).isEqualByComparingTo(new BigDecimal("62.10")); // 9 * 6.90
        assertThat(status.isComplete()).isFalse();
    }

    @Test
    void cost_to_complete_prefers_observed_market_price_over_theoretical_retail_price() {
        MangaEdition edition = MangaEdition.create("Death Note", "Black Edition", EditionTier.DELUXE, "Kana",
                6, new BigDecimal("14.90"), false, false, null);
        MarketPrice observed = MarketPrice.fromObservations(3, new BigDecimal("12.00"), new BigDecimal("10.00"),
                new BigDecimal("14.00"), new BigDecimal("14.90"), ConfidenceLevel.HIGH);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3, 4), edition, observed);

        assertThat(status.missingCount()).isEqualTo(2); // volumes 5 and 6
        assertThat(status.costToCompleteBasis()).isEqualTo(PriceBasis.OBSERVED_MARKET);
        assertThat(status.estimatedCostToComplete()).isEqualByComparingTo(new BigDecimal("24.00")); // 2 * 12.00
    }

    @Test
    void cost_to_complete_uses_an_ai_estimate_only_when_no_real_observation_exists() {
        MangaEdition edition = MangaEdition.create("Vinland Saga", "Deluxe", EditionTier.DELUXE, "Kurokawa",
                10, new BigDecimal("19.90"), false, false, null);
        MarketPrice aiEstimated = MarketPrice.aiEstimated(new BigDecimal("15.00"), new BigDecimal("19.90"), ConfidenceLevel.MEDIUM);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3, 4, 5, 6, 7, 8), edition, aiEstimated);

        assertThat(status.missingCount()).isEqualTo(2);
        assertThat(status.costToCompleteBasis()).isEqualTo(PriceBasis.AI_ESTIMATED);
        assertThat(status.estimatedCostToComplete()).isEqualByComparingTo(new BigDecimal("30.00")); // 2 * 15.00
    }

    @Test
    void a_fully_included_edition_is_reported_complete_with_zero_cost() {
        MangaEdition edition = MangaEdition.create("Death Note", "Black Edition", EditionTier.DELUXE, "Kana",
                6, new BigDecimal("14.90"), false, false, null);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3, 4, 5, 6), edition, null);

        assertThat(status.isComplete()).isTrue();
        assertThat(status.estimatedCostToComplete()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void the_three_argument_overload_never_reports_a_catalogued_vs_virtual_distinction() {
        // Used by PurchaseAnalysisEngine to assess a third-party listing - the user's catalogue
        // makes no sense in this context, see the javadoc of the overload.
        MangaEdition edition = MangaEdition.create("My Home Hero", "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3), edition, null);

        assertThat(status.cataloguedMissingVolumeNumbers()).isEmpty();
    }

    @Test
    void distinguishes_catalogued_but_unowned_missing_volumes_from_purely_virtual_ones() {
        // Step 6/8 (Volume != Ownership model): 4 owned (1-4), volume 5 catalogued but
        // not owned (e.g. sold again), volumes 6 to 10 purely virtual (never catalogued).
        MangaEdition edition = MangaEdition.create("Parasyte", "Standard", EditionTier.STANDARD, "Tonkam",
                10, new BigDecimal("7.50"), false, false, null);

        CollectionStatus status = calculator.compute(Set.of(1, 2, 3, 4), Set.of(1, 2, 3, 4, 5), edition, null);

        assertThat(status.missingVolumeNumbers()).containsExactly(5, 6, 7, 8, 9, 10);
        assertThat(status.cataloguedMissingVolumeNumbers()).containsExactly(5);
    }
}
