package com.iozycore.purchaseanalysis;

/**
 * Flat enumeration of edition tiers, deliberately WITHOUT any built-in
 * ordering - the preference hierarchy (e.g. Perfect > Deluxe/Prestige >
 * standard) must stay configurable per the specification, so it lives
 * exclusively in {@link CollectorPreferences#editionTierRanking()}, never
 * in the order these constants are declared.
 */
public enum EditionTier {
    STANDARD,
    DELUXE,
    PRESTIGE,
    PERFECT,
    COLLECTOR,
    INTEGRAL,
    OTHER
}
