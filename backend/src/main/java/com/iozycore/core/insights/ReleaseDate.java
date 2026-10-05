package com.iozycore.core.insights;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * A release date as a source knows it: to the day, or to the
 * month when that is all it can say.
 *
 * <p>The calendar never shows an approximate date (decision of the
 * design log, §44: "never an approximate date"). A precision
 * is not an approximation: "October 2026" is exactly what the
 * source knows, and this is what is shown. A year alone, however,
 * is not a calendar date - the BnF ("DL 2009") and BoardGameGeek
 * (year of publication) stop there, and these releases do not enter the
 * calendar.
 *
 * @param date      the day, or the first day of the month for a month precision
 * @param precision what the source really knows
 */
public record ReleaseDate(LocalDate date, Precision precision) implements Comparable<ReleaseDate> {

    public enum Precision { DAY, MONTH }

    private static final Pattern DAY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern MONTH = Pattern.compile("\\d{4}-\\d{2}");

    /** On the same day, the whole month comes before the exact day: it is the first possible date. */
    private static final Comparator<ReleaseDate> ORDER = Comparator.comparing(ReleaseDate::date)
            .thenComparing(release -> release.precision() == Precision.MONTH ? 0 : 1);

    public ReleaseDate {
        Objects.requireNonNull(date, "date");
        Objects.requireNonNull(precision, "precision");
        if (precision == Precision.MONTH && date.getDayOfMonth() != 1) {
            throw new IllegalArgumentException("Une date au mois près se porte au premier jour du mois : " + date);
        }
    }

    public static ReleaseDate ofDay(LocalDate day) {
        return new ReleaseDate(day, Precision.DAY);
    }

    public static ReleaseDate ofMonth(YearMonth month) {
        return new ReleaseDate(month.atDay(1), Precision.MONTH);
    }

    /**
     * "2026-10-14" -> day; "2026-10" -> month; everything else ("2026",
     * "DL 2009", empty, missing) -> nothing. An unreadable value does not throw:
     * the attributes are an untyped bag, and a shaky input must not
     * bring down the whole calendar.
     */
    public static Optional<ReleaseDate> parse(Object value) {
        if (!(value instanceof String text)) {
            return Optional.empty();
        }
        String trimmed = text.trim();
        try {
            if (DAY.matcher(trimmed).matches()) {
                return Optional.of(ofDay(LocalDate.parse(trimmed)));
            }
            if (MONTH.matcher(trimmed).matches()) {
                return Optional.of(ofMonth(YearMonth.parse(trimmed)));
            }
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    /** True when the release falls in the period - for a month, as soon as it covers one day of it. */
    public boolean isWithin(LocalDate from, LocalDate to) {
        return switch (precision) {
            case DAY -> !date.isBefore(from) && !date.isAfter(to);
            case MONTH -> {
                YearMonth month = YearMonth.from(date);
                yield !month.atEndOfMonth().isBefore(from) && !month.atDay(1).isAfter(to);
            }
        };
    }

    /** "2026-10-14" or "2026-10" - what the client receives, and what it can send back as is. */
    public String iso() {
        return precision == Precision.DAY ? date.toString() : YearMonth.from(date).toString();
    }

    @Override
    public int compareTo(ReleaseDate other) {
        return ORDER.compare(this, other);
    }
}
