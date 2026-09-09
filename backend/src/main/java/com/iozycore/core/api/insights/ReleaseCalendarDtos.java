package com.iozycore.core.api.insights;

import com.iozycore.core.insights.ReleaseCalendar;
import com.iozycore.core.insights.ReleaseEntry;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Le calendrier des sorties tel que le client le lit (lot 146). */
public final class ReleaseCalendarDtos {

    private ReleaseCalendarDtos() {
    }

    /**
     * @param from    premier jour de la période demandée
     * @param to      dernier jour, inclus
     * @param entries les sorties, dans l'ordre du calendrier - vide n'est pas une panne, c'est un mois calme
     */
    public record ReleaseCalendarResponse(LocalDate from, LocalDate to, List<ReleaseEntryResponse> entries) {
        public static ReleaseCalendarResponse from(ReleaseCalendar calendar) {
            return new ReleaseCalendarResponse(calendar.from(), calendar.to(),
                    calendar.entries().stream().map(ReleaseEntryResponse::from).toList());
        }
    }

    /**
     * @param date      « 2026-10-14 » au jour près, « 2026-10 » au mois près - jamais une année seule
     * @param precision DAY ou MONTH, ce que la source sait réellement
     * @param label     ce qui sort au sein de l'œuvre (« Tome 42 · Kana »), vide quand c'est l'œuvre elle-même
     * @param relation  OWNED, MISSING ou WANTED - ce que cette sortie représente pour la collection
     * @param source    d'où vient la date : GOOGLE_BOOKS, IGDB, ou MANUAL pour une date saisie sur la fiche
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
