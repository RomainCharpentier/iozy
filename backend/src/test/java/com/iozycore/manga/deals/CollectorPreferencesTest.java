package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Locks in the default collector profile verbatim from the specification - a change here should be deliberate. */
class CollectorPreferencesTest {

    @Test
    void defaults_match_the_specification_verbatim() {
        CollectorPreferences defaults = CollectorPreferences.defaults();

        // Five preferences were removed in Batch 84: they were read by
        // no line of the engine. What remains here is exactly what it reads.
        assertThat(defaults.editionTierRanking().get(0)).isEqualTo(EditionTier.PERFECT);
        assertThat(defaults.avoidOutdatedEditionWhenBetterExistsOrAnnounced()).isTrue();
        assertThat(defaults.conditionImportance()).isEqualTo(WeightLevel.HIGH);
        assertThat(defaults.minimumDiscountVsRetailPercent()).isEqualTo(20);
    }

    @Test
    void default_factor_weights_cover_every_factor_and_sum_to_100() {
        CollectorPreferences defaults = CollectorPreferences.defaults();

        assertThat(defaults.factorWeights()).containsOnlyKeys(VerdictFactor.values());
        int total = defaults.factorWeights().values().stream().mapToInt(Integer::intValue).sum();
        assertThat(total).isEqualTo(100);
    }

    @Test
    void every_edition_tier_is_represented_in_the_default_ranking() {
        CollectorPreferences defaults = CollectorPreferences.defaults();

        assertThat(defaults.editionTierRanking()).containsExactlyInAnyOrder(EditionTier.values());
    }
}
