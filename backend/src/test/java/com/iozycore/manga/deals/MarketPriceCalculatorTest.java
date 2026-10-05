package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.core.insights.ConfidenceLevel;

class MarketPriceCalculatorTest {

    private final MarketPriceCalculator calculator = new MarketPriceCalculator();

    private static MarketPriceObservation observation(VolumeRange scope, String price) {
        return MarketPriceObservation.record_(UUID.randomUUID(), scope, new BigDecimal(price),
                ListingPlatform.VINTED, null, LocalDate.now(), null);
    }

    @Test
    void falls_back_to_the_theoretical_retail_price_when_there_is_no_observation() {
        MangaEdition edition = MangaEdition.create("Vagabond", "VIZBIG", EditionTier.INTEGRAL, "Kodansha", 20,
                new BigDecimal("25.00"), false, false, null);

        MarketPrice price = calculator.computePerVolume(edition, List.of());

        assertThat(price.basis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
        assertThat(price.observationCount()).isZero();
        assertThat(price.observedMedian()).isNull();
        assertThat(price.theoreticalEstimate()).isEqualByComparingTo(new BigDecimal("25.00"));
    }

    @Test
    void normalizes_a_scoped_observation_to_a_per_volume_price() {
        // 60 EUR for a batch of 3 volumes (T1-3) -> 20 EUR/volume.
        MarketPriceObservation obs = observation(new VolumeRange(1, 3), "60.00");

        MarketPrice price = calculator.computePerVolume(null, List.of(obs));

        assertThat(price.basis()).isEqualTo(PriceBasis.OBSERVED_MARKET);
        assertThat(price.observationCount()).isEqualTo(1);
        assertThat(price.observedMedian()).isEqualByComparingTo(new BigDecimal("20.00"));
    }

    @Test
    void uses_an_ai_estimate_only_when_there_is_no_real_observation() {
        MangaEdition edition = MangaEdition.create("Vinland Saga", "Deluxe", EditionTier.DELUXE, "Kurokawa", 10,
                new BigDecimal("19.90"), false, false, null);
        AiPriceEstimate estimate = new AiPriceEstimate(new BigDecimal("15.00"), ConfidenceLevel.MEDIUM, "Édition recherchée");

        MarketPrice price = calculator.computePerVolume(edition, List.of(), estimate);

        assertThat(price.basis()).isEqualTo(PriceBasis.AI_ESTIMATED);
        assertThat(price.observationCount()).isZero();
        assertThat(price.observedMedian()).isNull(); // safeguard: never confused with a real observation
        assertThat(price.aiEstimatedPrice()).isEqualByComparingTo(new BigDecimal("15.00"));
        assertThat(price.theoreticalEstimate()).isEqualByComparingTo(new BigDecimal("19.90")); // kept for information only
        assertThat(price.confidence()).isEqualTo(ConfidenceLevel.MEDIUM);
        assertThat(price.bestEstimate()).isEqualByComparingTo(new BigDecimal("15.00"));
    }

    @Test
    void a_real_observation_always_wins_over_an_ai_estimate() {
        MarketPriceObservation obs = observation(VolumeRange.single(1), "12.00");
        AiPriceEstimate estimate = new AiPriceEstimate(new BigDecimal("15.00"), ConfidenceLevel.MEDIUM, null);

        MarketPrice price = calculator.computePerVolume(null, List.of(obs), estimate);

        assertThat(price.basis()).isEqualTo(PriceBasis.OBSERVED_MARKET);
        assertThat(price.observedMedian()).isEqualByComparingTo(new BigDecimal("12.00"));
        assertThat(price.aiEstimatedPrice()).isNull();
    }

    @Test
    void an_unscoped_observation_is_normalized_using_the_edition_total_volume_count() {
        MangaEdition edition = MangaEdition.create("Sanctuary", "Perfect Edition", EditionTier.PERFECT, "Glénat", 6,
                null, false, false, null);
        MarketPriceObservation obs = observation(null, "150.00"); // complete batch, no range given

        MarketPrice price = calculator.computePerVolume(edition, List.of(obs));

        assertThat(price.observedMedian()).isEqualByComparingTo(new BigDecimal("25.00")); // 150 / 6
    }

    @Test
    void computes_the_median_across_several_observations() {
        List<MarketPriceObservation> observations = List.of(
                observation(VolumeRange.single(1), "10.00"),
                observation(VolumeRange.single(2), "12.00"),
                observation(VolumeRange.single(3), "20.00"));

        MarketPrice price = calculator.computePerVolume(null, observations);

        assertThat(price.observationCount()).isEqualTo(3);
        assertThat(price.observedMedian()).isEqualByComparingTo(new BigDecimal("12.00"));
        assertThat(price.observedLow()).isEqualByComparingTo(new BigDecimal("10.00"));
        assertThat(price.observedHigh()).isEqualByComparingTo(new BigDecimal("20.00"));
        assertThat(price.confidence()).isEqualTo(ConfidenceLevel.HIGH); // >= 3 observations
    }

    @Test
    void an_observation_that_cannot_be_normalized_is_simply_ignored_never_invented() {
        // No range given AND no known edition -> impossible to
        // bring this price down to a price/volume, the observation is ignored rather
        // than guessing a denominator.
        MarketPriceObservation obs = observation(null, "150.00");

        MarketPrice price = calculator.computePerVolume(null, List.of(obs));

        assertThat(price.observationCount()).isZero();
        assertThat(price.basis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
    }
}
