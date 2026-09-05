package com.iozycore.manga.deals;

import java.math.BigDecimal;

/**
 * Pre-purchase condition scale, from "sealed/mint" to "visible defects".
 * Distinct from {@link com.iozycore.core.domain.ownership.OwnershipCondition}
 * (NEW/USED/DAMAGED), which only tracks a copy already in the collection -
 * this scale exists specifically to grade a second-hand listing before
 * buying it, as required by the purchase analysis specification.
 * <p>
 * {@link #genericDiscountVsRetail()} is a fallback used only when no real
 * market observation exists for the matched edition (see
 * {@link PriceBasis#THEORETICAL_ONLY}) - it must never be presented as an
 * observed market price, only as a theoretical estimate.
 */
public enum Condition {

    MINT_SEALED(new BigDecimal("0.10")),
    LIKE_NEW(new BigDecimal("0.25")),
    VERY_GOOD(new BigDecimal("0.35")),
    GOOD(new BigDecimal("0.45")),
    ACCEPTABLE(new BigDecimal("0.55")),
    VISIBLE_DEFECTS(new BigDecimal("0.65"));

    private final BigDecimal genericDiscountVsRetail;

    Condition(BigDecimal genericDiscountVsRetail) {
        this.genericDiscountVsRetail = genericDiscountVsRetail;
    }

    /** Generic discount vs new retail price for this condition (e.g. 0.35 = 35% off) - a rough fallback only. */
    public BigDecimal genericDiscountVsRetail() {
        return genericDiscountVsRetail;
    }
}
