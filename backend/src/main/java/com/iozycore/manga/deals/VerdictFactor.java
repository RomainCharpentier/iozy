package com.iozycore.manga.deals;

/**
 * The ten factors jointly weighed by {@link VerdictScorer} into a single
 * verdict. Default weights live in {@link CollectorPreferences#defaults()},
 * not here, so they stay genuinely configurable rather than hardcoded.
 */
public enum VerdictFactor {
    FINAL_PRICE_VS_FAIR_VALUE,
    RETAIL_DISCOUNT,
    REAL_MARKET_ALIGNMENT,
    CONDITION,
    COMPLETENESS,
    AVAILABILITY,
    EDITION_QUALITY,
    COST_TO_COMPLETE,
    NEW_EDITION_RISK,
    RARITY
}
