package com.iozycore.core.api.dto;

import com.iozycore.core.application.purchase.PurchaseService;
import com.iozycore.core.domain.purchase.MonthSpending;
import com.iozycore.core.domain.purchase.ToBuyLine;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** The "to buy" page on the wire (lot 216): the list, the month, the budget, "Je l'ai". */
public final class PurchaseDtos {

    private PurchaseDtos() {
    }

    /** @param monthlyBudget in euros, {@code null} when the account has none */
    public record BudgetResponse(BigDecimal monthlyBudget) {
    }

    /** @param monthlyBudget in euros; {@code null} removes the budget */
    public record BudgetRequest(BigDecimal monthlyBudget) {
    }

    /**
     * What was spent this month, by purchase date (acquiredAt), in the collector's time zone.
     *
     * @param month         "2026-11"
     * @param spent         the sum of the known prices
     * @param pricedCount   copies bought this month with a price
     * @param unpricedCount copies bought this month without a price (not in {@code spent})
     * @param monthlyBudget {@code null} when the account has none
     */
    public record MonthResponse(String month, BigDecimal spent, int pricedCount, int unpricedCount,
                                BigDecimal monthlyBudget) {

        public static MonthResponse from(MonthSpending spending, BigDecimal budget) {
            return new MonthResponse(spending.month().toString(), spending.spent(), spending.pricedCount(),
                    spending.unpricedCount(), budget);
        }
    }

    /** @param releaseDate "2026-10-14", "2026-10", or {@code null} */
    public record ToBuyElementResponse(String key, String label, Integer number, String coverImageUrl,
                                       WorkElement.State state, String releaseDate) {

        static ToBuyElementResponse from(WorkElement element) {
            return new ToBuyElementResponse(element.key(), element.label(), element.number(),
                    element.coverImageUrl(), element.state(),
                    element.releaseDate() == null ? null : element.releaseDate().iso());
        }
    }

    /**
     * One line to buy. "Je l'ai" acts on {@code elements[0]}.
     *
     * @param releaseDate      the release ahead of an UPCOMING line ("2026-10-14" or "2026-10"), else {@code null}
     * @param releasePrecision DAY or MONTH, {@code null} without a date
     */
    public record ToBuyLineResponse(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                                    ToBuyLine.Kind kind, CollectorStatus collectorStatus, String releaseDate,
                                    String releasePrecision, List<ToBuyElementResponse> elements) {

        public static ToBuyLineResponse from(ToBuyLine line) {
            return new ToBuyLineResponse(line.entityId(), line.entityTypeId(), line.title(), line.coverImageUrl(),
                    line.kind(), line.collectorStatus(),
                    line.releaseDate() == null ? null : line.releaseDate().iso(),
                    line.releaseDate() == null ? null : line.releaseDate().precision().name(),
                    line.elements().stream().map(ToBuyElementResponse::from).toList());
        }
    }

    /** @param elementKey the key of the element in GET /api/works/{entityId} ("volume-12", "work", …) */
    public record AcquireRequest(UUID entityId, String elementKey) {
    }

    /**
     * What "Je l'ai" created, to undo it: delete the ownership, and add the wish
     * back when one was removed.
     */
    public record AcquiredResponse(UUID ownershipId, UUID entityId, UUID variantId, boolean wishRemoved) {

        public static AcquiredResponse from(PurchaseService.Acquired acquired) {
            return new AcquiredResponse(acquired.ownershipId(), acquired.entityId(), acquired.variantId(),
                    acquired.wishRemoved());
        }
    }
}
