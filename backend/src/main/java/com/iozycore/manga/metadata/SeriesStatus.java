package com.iozycore.manga.metadata;

import java.util.Locale;
import java.util.Set;

/**
 * The publication status of a series, as the three manga databases
 * write it in the {@code seriesStatus} attribute - each in its own way:
 * AniList {@code RELEASING}, Jikan {@code Publishing}, MyAnimeList v2
 * {@code currently_publishing}. The nightly refresh of the release calendar
 * only reads again the series that are ongoing: a finished series has no
 * volume left to announce, and reading it again would cost quota for nothing (batch 146).
 */
public final class SeriesStatus {

    private static final Set<String> ONGOING = Set.of("releasing", "publishing", "currentlypublishing");

    private SeriesStatus() {
    }

    /** True for a series still being published; false for all the rest, unknown status included. */
    public static boolean isOngoing(Object attributeValue) {
        if (!(attributeValue instanceof String text)) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        return ONGOING.contains(normalized);
    }
}
