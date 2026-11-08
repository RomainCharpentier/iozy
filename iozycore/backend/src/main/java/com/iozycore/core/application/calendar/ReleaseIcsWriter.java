package com.iozycore.core.application.calendar;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Writes releases as an iCalendar feed (RFC 5545) that an agenda app subscribes to.
 *
 * <h2>Stable UIDs</h2>
 * An agenda app recognises an event by its UID from one reading to the next. The
 * UID is made of the work, the volume and the edition - never the date: when a
 * publisher moves a release, the app moves the event instead of showing it twice.
 *
 * <h2>Only what is known to the day</h2>
 * An agenda event needs a day. A release only known to the month is left out:
 * no date is made up.
 *
 * <h2>Same bytes for the same releases</h2>
 * DTSTAMP is the given day, not the instant of the call: two readings of an
 * unchanged calendar give the same file, so the ETag lets an app skip it.
 */
public final class ReleaseIcsWriter {

    private static final DateTimeFormatter COMPACT = DateTimeFormatter.BASIC_ISO_DATE;

    private ReleaseIcsWriter() {
    }

    public static String write(List<ReleaseEntry> entries, LocalDate stampDay) {
        List<String> lines = new ArrayList<>(List.of(
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Iozy//IozyCore releases//FR",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "X-WR-CALNAME:Iozy · Sorties",
                "X-WR-CALDESC:Les sorties de ta collection et de tes envies",
                // How often an app should read the feed again: the dates move at night.
                "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
                "X-PUBLISHED-TTL:PT12H"));
        String stamp = COMPACT.format(stampDay) + "T000000Z";
        Set<String> written = new LinkedHashSet<>();
        for (ReleaseEntry entry : entries) {
            if (entry.date().precision() != ReleaseDate.Precision.DAY) {
                continue;
            }
            String uid = uidOf(entry);
            // Two sources can date the same volume: the first one (calendar order) wins.
            if (!written.add(uid)) {
                continue;
            }
            LocalDate day = entry.date().date();
            lines.add("BEGIN:VEVENT");
            lines.add("UID:" + uid);
            lines.add("DTSTAMP:" + stamp);
            lines.add("DTSTART;VALUE=DATE:" + COMPACT.format(day));
            lines.add("DTEND;VALUE=DATE:" + COMPACT.format(day.plusDays(1)));
            lines.add("SUMMARY:" + escape(summaryOf(entry)));
            lines.add("DESCRIPTION:" + escape(descriptionOf(entry)));
            // A release does not make the owner busy.
            lines.add("TRANSP:TRANSPARENT");
            lines.add("END:VEVENT");
        }
        lines.add("END:VCALENDAR");
        StringBuilder ics = new StringBuilder();
        for (String line : lines) {
            ics.append(fold(line)).append("\r\n");
        }
        return ics.toString();
    }

    /** The work, the volume and the edition - what the release IS, not when. */
    static String uidOf(ReleaseEntry entry) {
        String key = entry.entityId() + "|" + (entry.volumeNumber() == null ? "work" : entry.volumeNumber())
                + "|" + (entry.editionName() == null ? "" : entry.editionName().trim().toLowerCase())
                + "|" + (entry.volumeNumber() == null ? entry.label() : "");
        return "release-" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)) + "@iozycore";
    }

    private static String summaryOf(ReleaseEntry entry) {
        return entry.label().isBlank() ? entry.entityTitle() : entry.entityTitle() + " · " + entry.label();
    }

    private static String descriptionOf(ReleaseEntry entry) {
        return switch (entry.relation()) {
            case OWNED -> "Déjà dans ta collection, ou précommandé";
            case MISSING -> "À acheter : il manque à ta collection";
            case WANTED -> "Dans tes envies";
        };
    }

    /** A TEXT value: backslash, semicolon, comma and line breaks are escaped. */
    static String escape(String value) {
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n");
    }

    /** Cuts a line longer than 75 octets: the next parts start with a space (RFC 5545, 3.1). */
    static String fold(String line) {
        StringBuilder out = new StringBuilder();
        int size = 0;
        int limit = 75;
        for (int i = 0; i < line.length(); ) {
            int codePoint = line.codePointAt(i);
            String character = new String(Character.toChars(codePoint));
            int octets = character.getBytes(StandardCharsets.UTF_8).length;
            if (size + octets > limit) {
                out.append("\r\n ");
                size = 0;
                limit = 74;
            }
            out.append(character);
            size += octets;
            i += Character.charCount(codePoint);
        }
        return out.toString();
    }
}
