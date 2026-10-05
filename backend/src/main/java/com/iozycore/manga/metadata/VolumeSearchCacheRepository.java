package com.iozycore.manga.metadata;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Durable storage of the result of {@link VolumeSearchProvider#searchVolumes}
 * (see V3__volume_search_cache.sql) - unlike the in-memory {@link TtlCache}
 * used elsewhere in {@link TomeSearchService}, this one
 * survives backend restarts. seriesTitle/author are expected to be already
 * normalized (trim + lowercase) by the caller, never shown as they are.
 */
public interface VolumeSearchCacheRepository {

    Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author);

    /** Replaces the existing row for this key if there is one (upsert) -
     * this is the entry point of the manual refresh ("Actualiser" button
     * on the client side): a new Google Books search overwrites the old
     * stored result instead of being added to it. */
    void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes);

    /** Forgets the row of this key, if it exists - see TomeSearchService.searchVolumes (Batch 126). */
    void delete(UUID entityTypeId, String seriesTitle, String author);

    /**
     * The stored results of several series of a type, in ONE read -
     * what the release calendar asks for all the owned
     * or wished series, instead of one read per series (batch 146). The
     * titles are expected normalized, like for {@link #find}. An empty list
     * of titles returns an empty list without reading anything.
     */
    List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles);

    /** The stored keys of this type and their freshness, without the volumes - to choose what to read again at night (batch 146). */
    List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId);
}
