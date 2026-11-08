package com.iozycore.core.domain.purchase;

import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MonthSpendingTest {

    private static final YearMonth NOVEMBER = YearMonth.of(2026, 11);

    private static Ownership copy(LocalDate acquiredAt, String price, OwnershipStatus status, Instant createdAt) {
        return Ownership.reconstitute(UUID.randomUUID(), UUID.randomUUID(), null, null, OwnershipCondition.NEW,
                status, acquiredAt, null, price == null ? null : new BigDecimal(price), createdAt);
    }

    @Test
    void sums_the_prices_by_purchase_date_and_counts_the_copies_without_a_price_apart() {
        Instant now = Instant.parse("2026-11-08T10:00:00Z");
        MonthSpending spending = MonthSpending.of(List.of(
                copy(LocalDate.of(2026, 11, 2), "7.95", OwnershipStatus.OWNED, now),
                // Sold since, but paid for this month.
                copy(LocalDate.of(2026, 11, 5), "12.50", OwnershipStatus.SOLD, now),
                copy(LocalDate.of(2026, 11, 6), null, OwnershipStatus.OWNED, now),
                // Entered the app this month, bought years ago: not spent this month.
                copy(LocalDate.of(2019, 3, 1), "40.00", OwnershipStatus.OWNED, now)), NOVEMBER);

        assertThat(spending.spent()).isEqualByComparingTo("20.45");
        assertThat(spending.pricedCount()).isEqualTo(2);
        assertThat(spending.unpricedCount()).isEqualTo(1);
        assertThat(spending.month()).isEqualTo(NOVEMBER);
    }
}
