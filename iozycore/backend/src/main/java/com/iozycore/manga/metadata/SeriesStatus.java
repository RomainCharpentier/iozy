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
    /** Not published right now, but not over either: AniList HIATUS / NOT_YET_RELEASED, Jikan "On Hiatus" /
     *  "Not yet published", MyAnimeList on_hiatus / not_yet_published. */
    private static final Set<String> NOT_OVER = Set.of("hiatus", "onhiatus", "notyetreleased", "notyetpublished");

    /** AniList {@code FINISHED}, Jikan {@code Finished}, MyAnimeList v2 {@code finished}. */
    private static final Set<String> FINISHED = Set.of("finished");

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

    /** True only when a source says the series is over; false for all the rest, unknown status included. */
    public static boolean isFinished(Object attributeValue) {
        if (!(attributeValue instanceof String text)) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        return FINISHED.contains(normalized);
    }

    /**
     * True for a series that can still announce a volume: ongoing, on hiatus, or
     * not started yet. The release refresh re-reads these (lot 208: a series on hiatus
     * was left out until then). A finished,
     * cancelled or discontinued series, or an unknown status, is not re-read.
     */
    public static boolean mayAnnounceVolumes(Object attributeValue) {
        if (isOngoing(attributeValue)) {
            return true;
        }
        if (!(attributeValue instanceof String text)) {
            return false;
        }
        return NOT_OVER.contains(text.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", ""));
    }
}
