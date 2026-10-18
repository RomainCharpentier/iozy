package com.iozycore.manga.metadata;

/**
 * A French title found by a {@link FrenchTitleProvider}, together with
 * how it was found: two results do not have the same
 * proof value at all, and
 * {@link FrenchTitleService#findFrenchTitle(com.iozycore.core.domain.catalog.EntityType, String, String, java.util.List, String)}
 * uses this to choose between providers (a match on the
 * searched series wins over a simple "same author" find, whatever
 * the order of the providers) and to decide if the
 * result must be checked before it is kept.
 */
public record FrenchTitleMatch(String title, Confidence confidence) {

    public enum Confidence {
        /**
         * The search that found this title contained the terms of the
         * searched series (full title, or a distinctive word of this title): it is
         * the query itself that links the result to the requested series.
         */
        SERIES_MATCHED,
        /**
         * Last resort "author only": NOTHING of the searched series
         * matched, the result is only a French book by this author. It can
         * be the right translated title ("Forget Me Not" -&gt; "Fragments
         * d'elles"), but just as well ANOTHER work by the same author
         * ("Vagabond" -&gt; "Slam Dunk") - to check before it is kept,
         * see FrenchTitleService.namesAnotherKnownWork.
         */
        AUTHOR_ONLY
    }

    public static FrenchTitleMatch seriesMatched(String title) {
        return new FrenchTitleMatch(title, Confidence.SERIES_MATCHED);
    }

    public static FrenchTitleMatch authorOnly(String title) {
        return new FrenchTitleMatch(title, Confidence.AUTHOR_ONLY);
    }
}
