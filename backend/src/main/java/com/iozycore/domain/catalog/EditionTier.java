package com.iozycore.domain.catalog;

/**
 * Flat enumeration of edition tiers - a catalog fact about a {@link MangaEdition}
 * (what kind of physical edition it is), deliberately WITHOUT any built-in
 * ordering: a preference hierarchy (e.g. Perfect > Deluxe/Prestige > standard)
 * is a Purchase Analysis concern, not a catalog one, so it lives exclusively in
 * {@code CollectorPreferences#editionTierRanking()}, never in the order these
 * constants are declared.
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
