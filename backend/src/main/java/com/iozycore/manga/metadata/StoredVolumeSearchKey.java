package com.iozycore.manga.metadata;

import java.time.Instant;

/**
 * The key and the freshness of a stored result, without its volumes - what the
 * nightly refresh of the release calendar reads to choose what to
 * read again, without loading the JSON of each series (batch 146).
 */
public record StoredVolumeSearchKey(String seriesTitle, String author, Instant fetchedAt) {

    public String key() {
        return StoredVolumeSearch.key(seriesTitle, author);
    }
}
