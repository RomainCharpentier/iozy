package com.iozycore.purchaseanalysis;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class VerdictScorerTest {

    private final VerdictScorer scorer = new VerdictScorer();
    private final CollectorPreferences defaults = CollectorPreferences.defaults();

    @Test
    void a_price_far_out_of_market_range_can_never_read_as_a_good_deal_regardless_of_edition_quality() {
        CollectionStatus complete = new CollectionStatus(null, 6, 0, List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("20"), new BigDecimal("100"), new BigDecimal("120"), new BigDecimal("83"), true,
                Condition.MINT_SEALED, false, List.of(complete), true, false, List.of(EditionTier.PERFECT), true,
                BigDecimal.ZERO, false, NegotiationAdvice.SKIP_LISTING);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isIn(Verdict.EXPENSIVE, Verdict.AVOID);
    }

    @Test
    void a_factor_with_no_usable_data_is_excluded_rather_than_defaulted_to_a_neutral_score() {
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("50"), null, null, null, false, Condition.GOOD, false, List.of(), false, false,
                List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        // Only CONDITION and REAL_MARKET_ALIGNMENT are always computable.
        assertThat(outcome.factorBreakdown()).containsOnlyKeys(VerdictFactor.CONDITION, VerdictFactor.REAL_MARKET_ALIGNMENT);
        assertThat(outcome.overallConfidence()).isEqualTo(ConfidenceLevel.LOW);
    }

    @Test
    void an_excellent_scenario_across_every_factor_reaches_the_excellent_deal_threshold() {
        CollectionStatus complete = new CollectionStatus(null, 11, 0, List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("50"), new BigDecimal("100"), new BigDecimal("150"), new BigDecimal("67"), true,
                Condition.MINT_SEALED, false, List.of(complete), true, false, List.of(EditionTier.PERFECT), true,
                BigDecimal.ZERO, false, NegotiationAdvice.ACCEPTABLE_AS_IS);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isEqualTo(Verdict.EXCELLENT_DEAL);
        assertThat(outcome.score()).isGreaterThanOrEqualTo(85);
    }

    @Test
    void a_poor_scenario_across_every_factor_reaches_avoid_or_expensive() {
        CollectionStatus incomplete = new CollectionStatus(null, 26, 20, List.of(), new BigDecimal("140"), PriceBasis.THEORETICAL_ONLY);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("200"), new BigDecimal("80"), new BigDecimal("90"), new BigDecimal("-5"), false,
                Condition.VISIBLE_DEFECTS, false, List.of(incomplete), true, true, List.of(EditionTier.STANDARD),
                true, new BigDecimal("140"), true, NegotiationAdvice.SKIP_LISTING);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isIn(Verdict.AVOID, Verdict.EXPENSIVE);
    }

    @Test
    void condition_weight_is_boosted_when_it_applies_to_a_box_or_slipcase() {
        VerdictScorer.Input containerInput = new VerdictScorer.Input(
                new BigDecimal("50"), null, null, null, false, Condition.VISIBLE_DEFECTS, true, List.of(), false,
                false, List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS);
        VerdictScorer.Input volumeInput = new VerdictScorer.Input(
                new BigDecimal("50"), null, null, null, false, Condition.VISIBLE_DEFECTS, false, List.of(), false,
                false, List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS);

        VerdictScorer.Outcome containerOutcome = scorer.score(containerInput, defaults);
        VerdictScorer.Outcome volumeOutcome = scorer.score(volumeInput, defaults);

        // Same CONDITION factor score in both cases, but the container's poor condition
        // is weighted more heavily against REAL_MARKET_ALIGNMENT (also 40), pulling the
        // overall score further down.
        assertThat(containerOutcome.score()).isLessThanOrEqualTo(volumeOutcome.score());
    }
}
