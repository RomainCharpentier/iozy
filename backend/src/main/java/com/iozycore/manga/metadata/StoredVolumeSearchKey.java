package com.iozycore.manga.metadata;

import java.time.Instant;

/**
 * La clé et la fraîcheur d'un résultat stocké, sans ses tomes - ce que le
 * rafraîchissement nocturne du calendrier des sorties lit pour choisir quoi
 * relire, sans charger le JSON de chaque série (lot 146).
 */
public record StoredVolumeSearchKey(String seriesTitle, String author, Instant fetchedAt) {

    public String key() {
        return StoredVolumeSearch.key(seriesTitle, author);
    }
}
