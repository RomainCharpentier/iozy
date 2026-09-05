package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class NegotiationEngineTest {

    private final NegotiationEngine engine = new NegotiationEngine();

    @Test
    void no_fair_value_means_no_negotiation_advice_can_be_given() {
        NegotiationRecommendation recommendation = engine.recommend(new BigDecimal("60"), null);

        assertThat(recommendation.advice()).isEqualTo(NegotiationAdvice.SKIP_LISTING);
        assertThat(recommendation.priceDataAvailable()).isFalse();
        assertThat(recommendation.recommendedOffer()).isNull();
    }

    @Test
    void asking_price_already_at_or_below_target_min_is_accepted_as_is_without_lowballing() {
        NegotiationRecommendation recommendation = engine.recommend(new BigDecimal("40"), new BigDecimal("50"));

        assertThat(recommendation.advice()).isEqualTo(NegotiationAdvice.ACCEPTABLE_AS_IS);
        assertThat(recommendation.recommendedOffer()).isEqualByComparingTo(new BigDecimal("40")); // no need to lowball
    }

    @Test
    void asking_price_within_the_fair_band_is_accepted_as_is() {
        NegotiationRecommendation recommendation = engine.recommend(new BigDecimal("51"), new BigDecimal("50"));

        assertThat(recommendation.advice()).isEqualTo(NegotiationAdvice.ACCEPTABLE_AS_IS);
        assertThat(recommendation.maxPrice()).isEqualByComparingTo(new BigDecimal("52.50"));
    }

    @Test
    void asking_price_moderately_above_fair_value_triggers_negotiate_with_a_three_price_range() {
        // fairValue = 50 -> targetMin = 47.50, maxPrice = 52.50, skip threshold = 65.625
        NegotiationRecommendation recommendation = engine.recommend(new BigDecimal("60"), new BigDecimal("50"));

        assertThat(recommendation.advice()).isEqualTo(NegotiationAdvice.NEGOTIATE);
        assertThat(recommendation.recommendedOffer()).isEqualByComparingTo(new BigDecimal("47.50"));
        assertThat(recommendation.targetPriceMin()).isEqualByComparingTo(new BigDecimal("47.50"));
        assertThat(recommendation.targetPriceMax()).isEqualByComparingTo(new BigDecimal("52.50"));
        assertThat(recommendation.maxPrice()).isEqualByComparingTo(new BigDecimal("52.50"));
        assertThat(recommendation.priceDataAvailable()).isTrue();
    }

    @Test
    void asking_price_far_above_fair_value_is_a_skip_not_an_unrealistic_offer() {
        // maxPrice = 52.50, skip threshold = 65.625 -> 70 is beyond it
        NegotiationRecommendation recommendation = engine.recommend(new BigDecimal("70"), new BigDecimal("50"));

        assertThat(recommendation.advice()).isEqualTo(NegotiationAdvice.SKIP_LISTING);
        assertThat(recommendation.recommendedOffer()).isNull();
        assertThat(recommendation.targetPriceMin()).isNull();
        assertThat(recommendation.maxPrice()).isNull();
        // The prices are withheld on purpose, but the fair value WAS known - the rationale even
        // quotes it. Reporting "no price data" here would make this skip indistinguishable from
        // the one above, where nothing at all could be estimated.
        assertThat(recommendation.priceDataAvailable()).isTrue();
    }
}
