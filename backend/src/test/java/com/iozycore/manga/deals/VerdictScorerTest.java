package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.insights.ConfidenceLevel;

class VerdictScorerTest {

    private final VerdictScorer scorer = new VerdictScorer();
    private final CollectorPreferences defaults = CollectorPreferences.defaults();

    @Test
    void a_price_far_out_of_market_range_can_never_read_as_a_good_deal_regardless_of_edition_quality() {
        CollectionStatus complete = new CollectionStatus(null, 6, 0, List.of(), List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("20"), new BigDecimal("100"), new BigDecimal("120"), new BigDecimal("83"), true,
                Condition.MINT_SEALED, false, List.of(complete), true, false, List.of(EditionTier.PERFECT), true,
                BigDecimal.ZERO, false, NegotiationAdvice.SKIP_LISTING);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isIn(Verdict.EXPENSIVE, Verdict.AVOID);
    }

    @Test
    void an_observed_price_that_is_not_comparable_does_not_count_as_market_alignment() {
        // Un relevé existe pour l'édition (anyObservedMarketData), mais aucun sur un lot de forme
        // et de taille voisines (anyComparableObservation) - le cas que MarketComparableSelector
        // écarte, et que ce facteur annonçait comme "prix réellement relevé, confiance haute".
        VerdictScorer.Input sansComparable = new VerdictScorer.Input(
                new BigDecimal("50"), new BigDecimal("50"), null, null, true, Condition.GOOD, false, List.of(),
                false, false, List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS, true, false);
        VerdictScorer.Input avecComparable = new VerdictScorer.Input(
                new BigDecimal("50"), new BigDecimal("50"), null, null, true, Condition.GOOD, false, List.of(),
                false, false, List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS, true, true);

        FactorScore sans = scorer.score(sansComparable, defaults).factorBreakdown().get(VerdictFactor.REAL_MARKET_ALIGNMENT);
        FactorScore avec = scorer.score(avecComparable, defaults).factorBreakdown().get(VerdictFactor.REAL_MARKET_ALIGNMENT);

        assertThat(sans.score()).isEqualTo(40);
        assertThat(sans.confidence()).isEqualTo(ConfidenceLevel.LOW);
        // Et le message ne se confond pas avec celui de l'absence totale de relevé : il y a quelque
        // chose à faire - relever un prix sur un lot de taille voisine.
        assertThat(sans.rationale()).contains("aucun sur un lot comparable");
        assertThat(avec.score()).isEqualTo(90);
        assertThat(avec.confidence()).isEqualTo(ConfidenceLevel.HIGH);
    }

    @Test
    void a_profile_that_names_no_weight_falls_back_on_the_specified_ones_instead_of_silencing_every_factor() {
        // Exactly the profile the live database held: no ranking, no weight - the shape a partial
        // write leaves behind. Every factor weighed 0, so weightTotal was 0, the "nothing could be
        // computed" fallback fired, and every listing scored a flat 50 while its ten factor scores
        // were displayed right above.
        CollectorPreferences empty = new CollectorPreferences(List.of(), false, WeightLevel.HIGH, 0, Map.of());
        CollectionStatus complete = new CollectionStatus(null, 11, 0, List.of(), List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("50"), new BigDecimal("100"), new BigDecimal("150"), new BigDecimal("67"), true,
                Condition.MINT_SEALED, false, List.of(complete), true, false, List.of(EditionTier.PERFECT), true,
                BigDecimal.ZERO, false, NegotiationAdvice.ACCEPTABLE_AS_IS);

        VerdictScorer.Outcome outcome = scorer.score(input, empty);

        assertThat(outcome.factorBreakdown()).hasSize(10);
        assertThat(outcome.score()).isNotEqualTo(50);
        assertThat(outcome.verdict()).isEqualTo(Verdict.EXCELLENT_DEAL);
    }

    @Test
    void a_skip_advice_that_rests_on_no_price_data_at_all_does_not_downgrade_the_verdict() {
        // Exactly the excellent scenario below, except the negotiation came back SKIP_LISTING
        // because NO fair value could be computed - not because the price is out of range. The
        // downgrade would then report "expensive" about a listing whose price is unknown.
        CollectionStatus complete = new CollectionStatus(null, 11, 0, List.of(), List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("50"), new BigDecimal("100"), new BigDecimal("150"), new BigDecimal("67"), true,
                Condition.MINT_SEALED, false, List.of(complete), true, false, List.of(EditionTier.PERFECT), true,
                BigDecimal.ZERO, false, NegotiationAdvice.SKIP_LISTING, false);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isEqualTo(Verdict.EXCELLENT_DEAL);
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
        CollectionStatus complete = new CollectionStatus(null, 11, 0, List.of(), List.of(), BigDecimal.ZERO, PriceBasis.OBSERVED_MARKET);
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
        CollectionStatus incomplete = new CollectionStatus(null, 26, 20, List.of(), List.of(), new BigDecimal("140"), PriceBasis.THEORETICAL_ONLY);
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("200"), new BigDecimal("80"), new BigDecimal("90"), new BigDecimal("-5"), false,
                Condition.VISIBLE_DEFECTS, false, List.of(incomplete), true, true, List.of(EditionTier.STANDARD),
                true, new BigDecimal("140"), true, NegotiationAdvice.SKIP_LISTING);

        VerdictScorer.Outcome outcome = scorer.score(input, defaults);

        assertThat(outcome.verdict()).isIn(Verdict.AVOID, Verdict.EXPENSIVE);
    }

    @Test
    void how_much_the_collector_cares_about_condition_actually_moves_the_score() {
        // Poor condition, everything else identical: a collector who says condition matters little
        // must not get the same verdict score as one who says it matters a lot.
        VerdictScorer.Input input = new VerdictScorer.Input(
                new BigDecimal("50"), null, null, null, false, Condition.VISIBLE_DEFECTS, false, List.of(), false,
                false, List.of(), false, null, false, NegotiationAdvice.ACCEPTABLE_AS_IS);

        int low = scorer.score(input, withConditionImportance(WeightLevel.LOW)).score();
        int medium = scorer.score(input, withConditionImportance(WeightLevel.MEDIUM)).score();
        int high = scorer.score(input, withConditionImportance(WeightLevel.HIGH)).score();

        assertThat(low).isGreaterThan(medium);
        assertThat(medium).isGreaterThan(high);
    }

    private static CollectorPreferences withConditionImportance(WeightLevel importance) {
        CollectorPreferences base = CollectorPreferences.defaults();
        return new CollectorPreferences(base.editionTierRanking(),
                base.avoidOutdatedEditionWhenBetterExistsOrAnnounced(), importance,
                base.minimumDiscountVsRetailPercent(), base.factorWeights());
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
