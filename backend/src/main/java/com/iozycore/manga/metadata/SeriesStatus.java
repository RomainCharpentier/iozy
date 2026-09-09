package com.iozycore.manga.metadata;

import java.util.Locale;
import java.util.Set;

/**
 * Le statut de publication d'une série, tel que les trois bases de mangas
 * l'écrivent dans l'attribut {@code seriesStatus} - chacune à sa façon :
 * AniList {@code RELEASING}, Jikan {@code Publishing}, MyAnimeList v2
 * {@code currently_publishing}. Le rafraîchissement nocturne du calendrier
 * des sorties ne relit que les séries en cours : une série terminée n'a plus
 * de tome à annoncer, et la relire coûterait du quota pour rien (lot 146).
 */
public final class SeriesStatus {

    private static final Set<String> ONGOING = Set.of("releasing", "publishing", "currentlypublishing");

    private SeriesStatus() {
    }

    /** Vrai pour une série encore en cours de publication ; faux pour tout le reste, statut inconnu compris. */
    public static boolean isOngoing(Object attributeValue) {
        if (!(attributeValue instanceof String text)) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        return ONGOING.contains(normalized);
    }
}
