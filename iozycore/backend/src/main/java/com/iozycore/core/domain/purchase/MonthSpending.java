package com.iozycore.core.domain.purchase;

import com.iozycore.core.domain.ownership.Ownership;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/**
 * What the collector spent in one month (lot 216).
 *
 * <h2>Which date</h2>
 * The purchase date ({@code acquiredAt}), the one the collector types and that
 * quick add sets to the day of the addition. Not the moment the row entered
 * the app ({@code createdAt}): importing an old collection with its prices
 * would otherwise read as a whole collection bought this month.
 *
 * <h2>Which copies</h2>
 * Every copy bought that month, still owned or not: a volume bought and sold
 * in the same month was still paid for. A copy without a price is counted
 * apart ({@link #unpricedCount}), never guessed.
 */
public record MonthSpending(YearMonth month, BigDecimal spent, int pricedCount, int unpricedCount) {

    public static MonthSpending of(List<Ownership> ownerships, YearMonth month) {
        BigDecimal spent = BigDecimal.ZERO;
        int priced = 0;
        int unpriced = 0;
        for (Ownership ownership : ownerships) {
            if (ownership.acquiredAt() == null || !YearMonth.from(ownership.acquiredAt()).equals(month)) {
                continue;
            }
            if (ownership.purchasePrice().isPresent()) {
                spent = spent.add(ownership.purchasePrice().get());
                priced++;
            } else {
                unpriced++;
            }
        }
        return new MonthSpending(month, spent, priced, unpriced);
    }
}
