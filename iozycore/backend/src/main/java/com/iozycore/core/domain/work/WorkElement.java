package com.iozycore.core.domain.work;

import com.iozycore.core.domain.insights.ReleaseDate;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Objects;
import java.util.UUID;

/**
 * One element of a work: a volume of a series, a game, an expansion of a box,
 * or the work itself when it is a single piece.
 *
 * @param key           stable within the work ("volume-12", "variant-{id}", "work"): the client keys its grid on it
 * @param label         what the grid shows ("Tome 12", the name of an expansion, the title)
 * @param number        the number of the element in its series, or {@code null} when it has none
 * @param coverImageUrl its own cover, or {@code null} (the client then shows the cover of the work)
 * @param state         where it stands for the collector
 * @param releaseDate   its release date when a source or the collector knows it, or {@code null}
 * @param variantId     the catalog variant behind the element, or {@code null} (a known gap in a series, the work itself)
 * @param ownershipId   the active ownership of the element, or {@code null}
 */
public record WorkElement(String key, String label, Integer number, String coverImageUrl, State state,
                          ReleaseDate releaseDate, UUID variantId, UUID ownershipId) {

    public enum State {
        /** In the collection. */
        OWNED,
        /** Published and not in the collection. */
        MISSING,
        /** Not in the collection, and in the wishes. */
        WANTED,
        /** Announced, not out yet, not in the collection. */
        UPCOMING
    }

    public WorkElement {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(state, "state");
        label = label == null ? "" : label;
    }

    /**
     * The state from what is known: owned first, then wanted, then not out yet,
     * then missing. A wished element stays WANTED even before its release: the
     * wish is the collector's word and must stay visible.
     */
    public static State stateOf(boolean owned, boolean wanted, ReleaseDate releaseDate, LocalDate today) {
        if (owned) {
            return State.OWNED;
        }
        if (wanted) {
            return State.WANTED;
        }
        if (isUpcoming(releaseDate, today)) {
            return State.UPCOMING;
        }
        return State.MISSING;
    }

    /**
     * True when the date is still ahead. A date known to the month only is
     * ahead for the whole month: the day may not have come yet, and an
     * element that may not be out is never counted as missing.
     */
    public static boolean isUpcoming(ReleaseDate releaseDate, LocalDate today) {
        if (releaseDate == null) {
            return false;
        }
        return switch (releaseDate.precision()) {
            case DAY -> releaseDate.date().isAfter(today);
            case MONTH -> !YearMonth.from(releaseDate.date()).isBefore(YearMonth.from(today));
        };
    }

    /** Not in the collection and published: what the collector lacks. */
    public boolean isLacking(LocalDate today) {
        return (state == State.MISSING || state == State.WANTED) && !isUpcoming(releaseDate, today);
    }
}
