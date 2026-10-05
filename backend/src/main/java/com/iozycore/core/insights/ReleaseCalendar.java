package com.iozycore.core.insights;

import java.time.LocalDate;
import java.util.List;

/**
 * The releases of a period, all categories mixed, in calendar
 * order. See {@link ReleaseCalendarService} for the rules - this record
 * only carries them.
 */
public record ReleaseCalendar(LocalDate from, LocalDate to, List<ReleaseEntry> entries) {

    public ReleaseCalendar {
        entries = List.copyOf(entries);
    }
}
