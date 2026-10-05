package com.iozycore.core.api.insights;

import com.iozycore.core.insights.ReleaseCalendar;
import com.iozycore.core.insights.ReleaseEntry;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The release calendar as the client reads it (batch 146). */
public final class ReleaseCalendarDtos {

    private ReleaseCalendarDtos() {
    }

    /**
     * @param from    first day of the requested period
     * @param to      last day, included
     * @param entries the releases, in calendar order - empty is not a failure, it is a quiet month
     */
    public record ReleaseCalendarResponse(LocalDate from, LocalDate to, List<ReleaseEntryResponse> entries) {
        public static ReleaseCalendarResponse from(ReleaseCalendar calendar) {
            return new ReleaseCalendarResponse(calendar.from(), calendar.to(),
                    calendar.entries().stream().map(ReleaseEntryResponse::from).toList());
        }
    }

    /**
     * @param date      "2026-10-14" to the day, "2026-10" to the month - never a year alone
     * @param precision DAY or MONTH, what the source really knows
     * @param label     what comes out within the work ("Tome 42 · Kana"), empty when it is the work itself
     * @param relation  OWNED, MISSING or WANTED - what this release means for the collection
     * @param source    where the date comes from: GOOGLE_BOOKS, IGDB, or MANUAL for a date typed on the detail page
     */
    public record ReleaseEntryResponse(String date, String precision, UUID entityId, String entityTitle,
                                        UUID entityTypeId, String label, Integer volumeNumber, String editionName,
                                        String coverImageUrl, String relation, String source) {
        public static ReleaseEntryResponse from(ReleaseEntry entry) {
            return new ReleaseEntryResponse(entry.date().iso(), entry.date().precision().name(), entry.entityId(),
                    entry.entityTitle(), entry.entityTypeId(), entry.label(), entry.volumeNumber(), entry.editionName(),
                    entry.coverImageUrl(), entry.relation().name(), entry.source());
        }
    }
}
