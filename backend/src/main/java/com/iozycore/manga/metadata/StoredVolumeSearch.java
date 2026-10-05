package com.iozycore.manga.metadata;

import java.time.Instant;
import java.util.List;

/**
 * A volume search result as it is stored durably, with its
 * key (normalized title and author, never shown as they are) and its
 * freshness - what the release calendar reads, at once for all
 * the series it is interested in (batch 146).
 */
public record StoredVolumeSearch(String seriesTitle, String author, List<VolumeCandidate> volumes, Instant fetchedAt) {

    public StoredVolumeSearch {
        volumes = List.copyOf(volumes);
    }

    /** The key under which {@link TomeSearchService} stores this result: normalized title, normalized author. */
    public String key() {
        return key(seriesTitle, author);
    }

    public static String key(String normalizedTitle, String normalizedAuthor) {
        return normalizedTitle + "|" + normalizedAuthor;
    }
}
