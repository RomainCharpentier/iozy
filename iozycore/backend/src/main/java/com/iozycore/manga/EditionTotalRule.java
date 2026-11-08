package com.iozycore.manga;

import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.TotalSource;
import com.iozycore.manga.metadata.VolumeCandidate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;

/**
 * The rules that turn the French volume lists into the volume count of ONE
 * edition. Pure: no provider, no database, so each rule has its own test.
 *
 * <h2>What the total means</h2>
 * The number of volumes of this edition published in France so far - what
 * can be missing today. It is the highest volume number the sources list for
 * the edition, so it grows while the series goes on, and the job revisits it.
 * It is never lowered by a provider: a list that comes back shorter (a source
 * silent, a page cut) is a hole in the answer, not volumes withdrawn.
 *
 * <h2>When the run is finished</h2>
 * Only when a source says so: the original series is finished (AniList,
 * Jikan or MyAnimeList status) AND the French list reaches exactly its volume
 * count. The original count alone never becomes a French total: a French
 * edition can be late, cut short or split another way (a Perfect edition has
 * fewer volumes).
 *
 * <h2>Never guessed</h2>
 * The volumes must be listed under the SAME edition name (case, accents and
 * punctuation folded). A list that stops below a volume already in the
 * catalogue does not know the whole edition: nothing is written.
 *
 * <h2>Out, not announced</h2>
 * A volume whose release date is after today (a pre-order on Google Books)
 * is not counted: it is not missing yet, and it must not close the run.
 */
final class EditionTotalRule {

    private EditionTotalRule() {
    }

    /** A total read in the sources, and whether the French run is over. */
    record Found(int totalVolumes, boolean frenchRunFinished) {
    }

    /**
     * @param highestKnownVolume the highest volume number already in the catalogue for this edition
     * @param originalTotal      the volume count of the original series, or null
     * @param originalFinished   whether a source says the original series is over
     * @param today              volumes released after this day are left out
     */
    static Optional<Found> fromCandidates(String editionName, List<VolumeCandidate> candidates,
                                          int highestKnownVolume, Integer originalTotal, boolean originalFinished,
                                          LocalDate today) {
        String wanted = normalize(editionName);
        if (wanted.isEmpty()) {
            return Optional.empty();
        }
        int highest = 0;
        for (VolumeCandidate candidate : candidates) {
            if (candidate.volumeNumber() > 0 && wanted.equals(normalize(candidate.edition()))
                    && isOut(candidate.releaseDate(), today)) {
                highest = Math.max(highest, candidate.volumeNumber());
            }
        }
        if (highest == 0 || highest < highestKnownVolume) {
            return Optional.empty();
        }
        boolean finished = originalFinished && originalTotal != null && highest == originalTotal;
        return Optional.of(new Found(highest, finished));
    }

    /**
     * Whether the job should read the sources again for this edition.
     * {@code null} = no edition row yet.
     */
    static boolean isDue(MangaEdition edition, Instant now, Duration recheckAfter) {
        if (edition == null) {
            return true;
        }
        if (edition.totalSource() == TotalSource.MANUAL || edition.frenchRunFinished()) {
            return false;
        }
        Instant checked = edition.totalCheckedAt();
        return checked == null || !checked.isAfter(now.minus(recheckAfter));
    }

    /**
     * The edition after a search that ANSWERED. A manual total comes back
     * untouched; without a usable total only the check time moves.
     */
    static MangaEdition apply(MangaEdition edition, Optional<Found> found, Instant now) {
        return apply(edition, found, now, true);
    }

    /**
     * @param answeredInFull false when a source was silent: a total found is
     *                       written, but the check time stays as it was, so
     *                       the edition is read again at the next run.
     */
    static MangaEdition apply(MangaEdition edition, Optional<Found> found, Instant now, boolean answeredInFull) {
        if (edition.totalSource() == TotalSource.MANUAL) {
            return edition;
        }
        if (found.isEmpty()) {
            return edition.withTotalChecked(now);
        }
        int total = found.get().totalVolumes();
        boolean finished = found.get().frenchRunFinished();
        Integer current = edition.totalVolumes();
        if (current != null && current > total) {
            // Never lowered by a provider; the finished flag only holds for the count that proved it.
            total = current;
            finished = edition.frenchRunFinished();
        }
        return edition.withProviderTotal(total, finished, answeredInFull ? now : edition.totalCheckedAt());
    }

    /**
     * Whether a volume is out on {@code today}. The date is partial ISO
     * ("2026-10-14", "2026-10" or "2026"); no date, or one that cannot be
     * read, counts as out (the BnF lists what was deposited).
     */
    static boolean isOut(String releaseDate, LocalDate today) {
        if (releaseDate == null || releaseDate.isBlank()) {
            return true;
        }
        String date = releaseDate.trim();
        try {
            if (date.length() >= 10) {
                return !LocalDate.parse(date.substring(0, 10)).isAfter(today);
            }
            if (date.length() == 7) {
                return !YearMonth.parse(date).isAfter(YearMonth.from(today));
            }
            if (date.length() == 4) {
                return Integer.parseInt(date) <= today.getYear();
            }
        } catch (DateTimeParseException | NumberFormatException e) {
            return true;
        }
        return true;
    }

    private static String normalize(String value) {
        return value == null ? "" : TexteRecherche.normaliser(value).trim();
    }
}
