package com.iozycore.manga.recognition;

/**
 * What the IozyCore catalog knows about what has just been recognised.
 *
 * <p>This question is <b>separate</b> from recognition itself: reading
 * "Platinum End 4" on a photo and knowing whether this series exists in the
 * catalog are two things. Mixing them would bring an approximate reading
 * into the catalog - but the catalog remains the source of truth,
 * and an engine result is never one.
 */
public enum CatalogStatus {

    /** The series exists in the catalog, and the edition read matches it. */
    MATCHED,

    /**
     * The series exists, but the edition was not read or matches no
     * known edition. The screen shows "édition à confirmer" - it never chooses
     * one, see {@link RecognitionCatalogResolver}.
     */
    EDITION_TO_CONFIRM,

    /**
     * Recognised, but missing from the local catalog. Nothing is created: the user
     * will go through the usual catalog flow if they wish.
     */
    NOT_IN_CATALOG
}
