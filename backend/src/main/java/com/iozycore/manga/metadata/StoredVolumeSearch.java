package com.iozycore.manga.metadata;

import java.time.Instant;
import java.util.List;

/**
 * Un résultat de recherche de tomes tel qu'il est stocké durablement, avec sa
 * clé (titre et auteur normalisés, jamais affichés tels quels) et sa
 * fraîcheur - ce que le calendrier des sorties lit, en une fois pour toutes
 * les séries qui l'intéressent (lot 146).
 */
public record StoredVolumeSearch(String seriesTitle, String author, List<VolumeCandidate> volumes, Instant fetchedAt) {

    public StoredVolumeSearch {
        volumes = List.copyOf(volumes);
    }

    /** La clé sous laquelle {@link TomeSearchService} range ce résultat : titre normalisé, auteur normalisé. */
    public String key() {
        return key(seriesTitle, author);
    }

    public static String key(String normalizedTitle, String normalizedAuthor) {
        return normalizedTitle + "|" + normalizedAuthor;
    }
}
