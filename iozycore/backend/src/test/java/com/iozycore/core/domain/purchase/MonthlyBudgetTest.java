package com.iozycore.core.domain.purchase;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MonthlyBudgetTest {

    @Test
    void a_budget_is_a_positive_amount_in_cents() {
        assertThat(MonthlyBudget.create(new BigDecimal("150.555"), Instant.now()).amount())
                .isEqualByComparingTo("150.56");
        assertThatThrownBy(() -> MonthlyBudget.create(BigDecimal.ZERO, Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MonthlyBudget.create(new BigDecimal("-5"), Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MonthlyBudget.create(new BigDecimal("100000.01"), Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void an_amount_that_rounds_to_zero_is_refused() {
        assertThatThrownBy(() -> MonthlyBudget.create(new BigDecimal("0.004"), Instant.now()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positif");
    }
}
