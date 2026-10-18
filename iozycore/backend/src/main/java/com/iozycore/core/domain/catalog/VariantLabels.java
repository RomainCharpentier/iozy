package com.iozycore.core.domain.catalog;

/**
 * Label convention of a Volume ("Tome 3 — Black Édition"). Extracted here
 * because it is NOT cosmetic: QuickAddService deduplicates volumes
 * by this exact label (see {@link Entity#findVariantByLabel}). Two
 * places that each computed it on their own would end up different,
 * and a volume renumbered on one side would be created twice on the other.
 */
public final class VariantLabels {

    private VariantLabels() {
    }

    /** {@code edition} null/empty: just "Tome 3" - a series whose volumes
     * have no given edition is a normal case (see EditionGroup). */
    public static String of(int volumeNumber, String edition) {
        String base = "Tome " + volumeNumber;
        return (edition == null || edition.isBlank()) ? base : base + " — " + edition.trim();
    }
}
