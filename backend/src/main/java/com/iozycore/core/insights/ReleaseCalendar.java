package com.iozycore.core.insights;

import java.time.LocalDate;
import java.util.List;

/**
 * Les sorties d'une période, toutes catégories confondues, dans l'ordre du
 * calendrier. Voir {@link ReleaseCalendarService} pour les règles - ce record
 * ne fait que les transporter.
 */
public record ReleaseCalendar(LocalDate from, LocalDate to, List<ReleaseEntry> entries) {

    public ReleaseCalendar {
        entries = List.copyOf(entries);
    }
}
