package com.iozycore.core.insights;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Une date de sortie telle qu'une source la connaît : au jour près, ou au
 * mois près quand c'est tout ce qu'elle sait dire.
 *
 * <p>Le calendrier n'affiche jamais une date approximative (décision du
 * journal de design, §44 : « jamais une date approximative »). Une précision
 * n'est pas une approximation : « octobre 2026 » est exactement ce que la
 * source sait, et c'est ce qui est montré. Une année seule, en revanche,
 * n'est pas une date de calendrier - la BnF (« DL 2009 ») et BoardGameGeek
 * (année de parution) en restent là, et ces sorties n'entrent pas dans le
 * calendrier.
 *
 * @param date      le jour, ou le premier jour du mois pour une précision au mois
 * @param precision ce que la source sait réellement
 */
public record ReleaseDate(LocalDate date, Precision precision) implements Comparable<ReleaseDate> {

    public enum Precision { DAY, MONTH }

    private static final Pattern DAY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern MONTH = Pattern.compile("\\d{4}-\\d{2}");

    /** Au même jour, le mois entier passe avant le jour précis : c'est la première date possible. */
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
     * « 2026-10-14 » → jour ; « 2026-10 » → mois ; tout le reste (« 2026 »,
     * « DL 2009 », vide, absent) → rien. Une valeur illisible ne lève pas :
     * les attributs sont un sac non typé, et une saisie bancale ne doit pas
     * faire tomber le calendrier entier.
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

    /** Vrai quand la sortie tombe dans la période - pour un mois, dès qu'il en recouvre un jour. */
    public boolean isWithin(LocalDate from, LocalDate to) {
        return switch (precision) {
            case DAY -> !date.isBefore(from) && !date.isAfter(to);
            case MONTH -> {
                YearMonth month = YearMonth.from(date);
                yield !month.atEndOfMonth().isBefore(from) && !month.atDay(1).isAfter(to);
            }
        };
    }

    /** « 2026-10-14 » ou « 2026-10 » - ce que le client reçoit, et ce qu'il peut renvoyer tel quel. */
    public String iso() {
        return precision == Precision.DAY ? date.toString() : YearMonth.from(date).toString();
    }

    @Override
    public int compareTo(ReleaseDate other) {
        return ORDER.compare(this, other);
    }
}
