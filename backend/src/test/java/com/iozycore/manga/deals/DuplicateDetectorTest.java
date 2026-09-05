package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.insights.ConfidenceLevel;

class DuplicateDetectorTest {

    private final DuplicateDetector detector = new DuplicateDetector();

    @Test
    void no_overlap_means_every_volume_is_useful() {
        DuplicateAnalysis result = detector.detect(Set.of(1, 2, 3), Set.of(10, 11), new BigDecimal("30"),
                MarketPrice.noObservations(new BigDecimal("7"), ConfidenceLevel.LOW));

        assertThat(result.hasDuplicates()).isFalse();
        assertThat(result.usefulVolumeCount()).isEqualTo(3);
        assertThat(result.pricePerUsefulVolume()).isEqualByComparingTo(new BigDecimal("10.00")); // 30 / 3
        assertThat(result.maxWorthwhilePrice()).isEqualByComparingTo(new BigDecimal("21")); // 7 * 3
    }

    @Test
    void owned_volumes_are_excluded_from_the_useful_count_and_price() {
        DuplicateAnalysis result = detector.detect(Set.of(1, 2, 3, 4), Set.of(1, 2), new BigDecimal("40"),
                MarketPrice.noObservations(new BigDecimal("8"), ConfidenceLevel.LOW));

        assertThat(result.duplicateVolumeNumbers()).containsExactlyInAnyOrder(1, 2);
        assertThat(result.usefulVolumeCount()).isEqualTo(2);
        assertThat(result.pricePerUsefulVolume()).isEqualByComparingTo(new BigDecimal("20.00")); // 40 / 2 useful
        assertThat(result.maxWorthwhilePrice()).isEqualByComparingTo(new BigDecimal("16")); // 8 * 2 useful
    }

    @Test
    void owning_every_volume_in_the_lot_leaves_nothing_useful() {
        DuplicateAnalysis result = detector.detect(Set.of(1, 2), Set.of(1, 2), new BigDecimal("20"),
                MarketPrice.noObservations(new BigDecimal("7"), ConfidenceLevel.LOW));

        assertThat(result.usefulVolumeCount()).isZero();
        assertThat(result.pricePerUsefulVolume()).isNull(); // dividing by zero useful volumes makes no sense
        assertThat(result.maxWorthwhilePrice()).isNull();
    }

    @Test
    void an_unknown_per_volume_price_never_invents_a_worthwhile_threshold() {
        MarketPrice unknown = new MarketPrice(0, null, null, null, null, PriceBasis.THEORETICAL_ONLY, ConfidenceLevel.LOW, null);

        DuplicateAnalysis result = detector.detect(Set.of(1, 2), Set.of(), new BigDecimal("20"), unknown);

        assertThat(result.usefulVolumeCount()).isEqualTo(2);
        assertThat(result.maxWorthwhilePrice()).isNull();
        assertThat(result.pricePerUsefulVolume()).isEqualByComparingTo(new BigDecimal("10.00")); // still known from itemCostShare
    }

    @Test
    void an_empty_already_owned_set_never_throws_and_reports_no_duplicates() {
        DuplicateAnalysis result = detector.detect(Set.of(1), null, new BigDecimal("10"),
                MarketPrice.noObservations(new BigDecimal("7"), ConfidenceLevel.LOW));

        assertThat(result.hasDuplicates()).isFalse();
        assertThat(result.usefulVolumeCount()).isEqualTo(1);
    }
}
