package com.iozycore.manga.metadata;

import com.iozycore.core.domain.shared.TexteRecherche;

/**
 * A precise volume of a real French edition of a series (e.g. "Tome 5"
 * of the "Kana" edition), with its own cover - distinct from
 * {@link MetadataCandidate} which describes the SERIES as a whole (one
 * candidate per work, not one per volume). Result of
 * {@link VolumeSearchProvider#searchVolumes}, used to offer a
 * visual selection of owned volumes (Mangacollec style) instead of
 * typing a volume number blindly.
 *
 * @param edition      detected edition name (e.g. "Kana", "Édition
 *                     originale") - never empty, falls back to the raw publisher
 *                     if no collection name could be isolated.
 * @param volumeNumber volume number, as extracted from the title of the source entry.
 * @param imageUrl     cover of THIS precise volume (can differ from volume to
 *                     volume), or null if the source gives none.
 * @param title        raw title of the source entry, kept for possible
 *                     debugging - never shown as it is.
 * @param isbn         ISBN of THIS volume, digits only, or null - it is what
 *                     tells apart two editions of the same publisher with the
 *                     same volume number (see
 *                     {@code TomeSearchService.separerLesEditionsHomonymes}).
 * @param annee        publication year, or null - used to NAME an edition
 *                     separated this way, never to decide the separation.
 * @param releaseDate  the release date as the source knows it, in
 *                     partial ISO: "2026-10-14", "2026-10" or "2026" -
 *                     or null. This is what the release calendar reads
 *                     (batch 146), which only takes the day and month from it: a
 *                     year alone is not a calendar date. Google
 *                     Books gives the day (pre-orders included), the BnF and
 *                     Open Library the year alone.
 */
public record VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title,
                               String isbn, Integer annee, String releaseDate) {

    /**
     * The two edition identification fields are optional: this
     * constructor leaves untouched the callers (and the tests) that have
     * none - same method as {@code PurchaseAnalysisEngine.ItemContext} in
     * Batch Phase 2, to add a field to a record without touching its
     * dozens of call sites.
     */
    public VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title) {
        this(edition, volumeNumber, imageUrl, title, null, null, null);
    }

    /** Without a release date - the call sites from before the release calendar (batch 146). */
    public VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title, String isbn, Integer annee) {
        this(edition, volumeNumber, imageUrl, title, isbn, annee, null);
    }

    /**
     * The most precise date of the two - "2026-10-14" wins over
     * "2026-10", which wins over "2026"; at equal precision, the first one.
     * This is how a volume seen by the BnF (year alone) and by Google Books
     * (day) keeps the day, whichever provider came first.
     */
    public static String mostPreciseReleaseDate(String first, String second) {
        if (first == null) {
            return second;
        }
        if (second == null) {
            return first;
        }
        return second.length() > first.length() ? second : first;
    }

    /** The digits of the ISBN, without hyphens or spaces - null if absent or empty. */
    public String isbnNormalise() {
        if (isbn == null) {
            return null;
        }
        String chiffres = isbn.replaceAll("[^0-9Xx]", "");
        return chiffres.isBlank() ? null : chiffres.toUpperCase();
    }

    /**
     * The identity of a volume in a series: (edition, number), ignoring case
     * and spaces. A series has a volume 1 PER edition - the number alone
     * identifies nothing.
     *
     * <p>Static and taking its two parts separately because the two
     * callers do not start from the same object: {@link TomeSearchService}
     * removes duplicate candidates, {@code MetadataController} compares a Variant
     * already cataloged to these candidates to say "already owned". Each one
     * had its own copy.
     */
    public static String key(String edition, int volumeNumber) {
        // Accents and punctuation folded too (Batch 125): the BnF writes
        // "Kazé", Google Books "KAZE", and that was two editions.
        return TexteRecherche.normaliser(edition) + "|" + volumeNumber;
    }

    public String key() {
        return key(edition, volumeNumber);
    }
}
